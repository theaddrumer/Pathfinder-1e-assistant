using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace TabletopLauncher {
    public sealed class Settings {
        public string TunnelId {get;set;}
        public string OrganizationId {get;set;}
        public string TunnelPath {get;set;}
        public string StatePath {get;set;}
        public bool RememberKey {get;set;}
        public string ProtectedKey {get;set;}
        public Settings() {
            TunnelId=""; OrganizationId=""; TunnelPath=""; ProtectedKey="";
            StatePath=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),".tabletop-kernel","encounter.json");
            RememberKey=true;
        }
    }
    public static class SettingsStore {
        public static readonly string DirectoryPath=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"TabletopKernel","Launcher");
        public static readonly string FilePath=Path.Combine(DirectoryPath,"settings.json");
        static readonly byte[] Entropy=Encoding.UTF8.GetBytes("TabletopKernel.WindowsLauncher.v1");
        public static Settings Load(string file) {
            if(!File.Exists(file))return new Settings();
            if(new FileInfo(file).Length>65536)throw new InvalidDataException("Launcher settings are too large.");
            var result=new JavaScriptSerializer().Deserialize<Settings>(File.ReadAllText(file));
            if(result==null)throw new InvalidDataException("Launcher settings are empty.");
            return result;
        }
        public static string Protect(string key) {
            if(String.IsNullOrEmpty(key))return "";
            byte[] plain=Encoding.UTF8.GetBytes(key);
            try{return Convert.ToBase64String(ProtectedData.Protect(plain,Entropy,DataProtectionScope.CurrentUser));}
            finally{Array.Clear(plain,0,plain.Length);}
        }
        public static string Unprotect(string value) {
            if(String.IsNullOrEmpty(value))return "";
            byte[] plain=ProtectedData.Unprotect(Convert.FromBase64String(value),Entropy,DataProtectionScope.CurrentUser);
            try{return Encoding.UTF8.GetString(plain);}finally{Array.Clear(plain,0,plain.Length);}
        }
        public static void Save(string file,Settings settings,string key) {
            settings.ProtectedKey=settings.RememberKey?Protect(key):"";
            Directory.CreateDirectory(Path.GetDirectoryName(file));
            string temporary=file+"."+Guid.NewGuid().ToString("N")+".tmp";
            try {
                byte[] data=Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(settings));
                using(var stream=new FileStream(temporary,FileMode.CreateNew,FileAccess.Write,FileShare.None)){stream.Write(data,0,data.Length);stream.Flush(true);}
                if(File.Exists(file))File.Replace(temporary,file,null);else File.Move(temporary,file);
            }finally{if(File.Exists(temporary))File.Delete(temporary);}
        }
    }
    public static class LaunchRules {
        public static string Validate(Settings s,string key,string root) {
            if(!Regex.IsMatch(s.TunnelId??"",@"\Atunnel_[a-z0-9]{32}\z"))return "Enter your tunnel ID (tunnel_ followed by 32 lowercase letters or digits). The API key goes in the separate API key field.";
            if(String.IsNullOrWhiteSpace(key)||key.StartsWith("tunnel_")||key.Any(Char.IsWhiteSpace)||key.Length>4096)return "Enter your API key in the API key field. Do not enter the tunnel ID there.";
            if(!String.IsNullOrEmpty(s.OrganizationId)&&!Regex.IsMatch(s.OrganizationId,@"\A[A-Za-z0-9_-]{1,160}\z"))return "The optional organization ID must contain only letters, numbers, underscores or hyphens.";
            if(String.IsNullOrWhiteSpace(s.TunnelPath)||!Path.IsPathRooted(s.TunnelPath)||!File.Exists(s.TunnelPath)||!s.TunnelPath.EndsWith(".exe",StringComparison.OrdinalIgnoreCase))return "Choose the tunnel-client-runtime.exe application you downloaded using Browse.";
            if(String.IsNullOrWhiteSpace(s.StatePath)||!Path.IsPathRooted(s.StatePath)||Directory.Exists(s.StatePath))return "Choose a full path to an encounter JSON file under More settings.";
            if(!File.Exists(Path.Combine(root,"runtime","node.exe"))||!File.Exists(Path.Combine(root,"launcher","launcher_host.mjs")))return "The application files are incomplete. Extract the entire ZIP to a folder, then open Tabletop Launcher.exe from that folder.";
            return null;
        }
        // Windows CommandLineToArgvW/CRT escaping; never invoke cmd.exe or PowerShell.
        public static string Quote(string value) {
            var b=new StringBuilder("\"");int slashes=0;
            foreach(char c in value){if(c=='\\'){slashes++;continue;}if(c=='\"'){b.Append('\\',slashes*2+1);b.Append(c);}else{b.Append('\\',slashes);b.Append(c);}slashes=0;}
            b.Append('\\',slashes*2);return b.Append('"').ToString();
        }
        public static string Redact(string line,string key) {
            string result=line??"";
            if(!String.IsNullOrEmpty(key))result=result.Replace(key,"[key removed]");
            result=Regex.Replace(result,@"sk-[A-Za-z0-9_-]+","[key removed]");
            result=Regex.Replace(result,@"(?i)(Bearer\s+)\S+","$1[key removed]");
            return result.Length>2500?result.Substring(0,2500)+" …":result;
        }
        public static ProcessStartInfo StartInfo(string file,string arguments,string root) {
            var p=new ProcessStartInfo(file,arguments){WorkingDirectory=root,UseShellExecute=false,CreateNoWindow=true,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true};
            string[] prefixes={"CONTROL_PLANE_","MCP_","HARPOON_","HEALTH_","LOG_","TUNNEL_CLIENT_","TABLETOP_","NODE_"};
            foreach(string name in p.EnvironmentVariables.Keys.Cast<string>().ToArray()){
                if(prefixes.Any(prefix=>name.StartsWith(prefix,StringComparison.OrdinalIgnoreCase))||name.Equals("OPENAI_API_KEY",StringComparison.OrdinalIgnoreCase)||name.Equals("CA_BUNDLE",StringComparison.OrdinalIgnoreCase))p.EnvironmentVariables.Remove(name);
            }
            return p;
        }
        public static ProcessStartInfo ServerInfo(string root,Settings settings) {
            var p=StartInfo(Path.Combine(root,"runtime","node.exe"),Quote(Path.Combine(root,"launcher","launcher_host.mjs")),root);
            p.EnvironmentVariables["TABLETOP_HOST"]="127.0.0.1";
            p.EnvironmentVariables["TABLETOP_PORT"]="8787";
            p.EnvironmentVariables["TABLETOP_PLAYER_PORT"]="8788";
            p.EnvironmentVariables["TABLETOP_STATE_PATH"]=settings.StatePath;
            return p;
        }
        public static ProcessStartInfo TunnelInfo(string root,Settings settings,string key) {
            var p=StartInfo(settings.TunnelPath,"run --mcp.server-url \"url=http://127.0.0.1:8787/mcp\" --health.listen-addr 127.0.0.1:0 --log.level info",root);
            p.EnvironmentVariables["CONTROL_PLANE_API_KEY"]=key;
            p.EnvironmentVariables["CONTROL_PLANE_TUNNEL_ID"]=settings.TunnelId;
            if(!String.IsNullOrEmpty(settings.OrganizationId))p.EnvironmentVariables["CONTROL_PLANE_ORGANIZATION_ID"]=settings.OrganizationId;
            return p;
        }
        public static void CheckPort(int port) {
            var listener=new TcpListener(IPAddress.Loopback,port);
            try{listener.Server.ExclusiveAddressUse=true;listener.Start();}
            catch(SocketException){throw new IOException("Port "+port+" is already in use. Stop your old calculator server (the 8787 command window) before clicking Start. The launcher will not close other programs for you.");}
            finally{listener.Stop();}
        }
    }
    // Each run owns a fresh kill-on-close job. It never attaches to old user processes.
    public sealed class ProcessJob:IDisposable {
        IntPtr handle;
        [StructLayout(LayoutKind.Sequential)] struct Basic {public long PerProcess,PerJob;public uint Flags;public UIntPtr Min,Max;public uint Active;public UIntPtr Affinity;public uint Priority,Scheduling;}
        [StructLayout(LayoutKind.Sequential)] struct Io {public ulong Read,Write,Other,ReadBytes,WriteBytes,OtherBytes;}
        [StructLayout(LayoutKind.Sequential)] struct Extended {public Basic Basic;public Io Io;public UIntPtr ProcessMemory,JobMemory,PeakProcess,PeakJob;}
        [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr security,string name);
        [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int info,IntPtr data,uint length);
        [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
        [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
        public ProcessJob() {
            handle=CreateJobObject(IntPtr.Zero,null);if(handle==IntPtr.Zero)throw new Win32Exception();
            var info=new Extended();info.Basic.Flags=0x2000;
            int size=Marshal.SizeOf(typeof(Extended));IntPtr data=Marshal.AllocHGlobal(size);
            try{Marshal.StructureToPtr(info,data,false);if(!SetInformationJobObject(handle,9,data,(uint)size))throw new Win32Exception();}
            catch{Dispose();throw;}finally{Marshal.FreeHGlobal(data);}
        }
        public void Add(Process process){if(!AssignProcessToJobObject(handle,process.Handle))throw new Win32Exception(Marshal.GetLastWin32Error(),"Windows could not supervise the background process. Startup was cancelled.");}
        public void Dispose(){if(handle!=IntPtr.Zero){CloseHandle(handle);handle=IntPtr.Zero;}}
    }
    public sealed class SessionController {
        public event Action Changed;
        public event Action<string> LogLine;
        public string ServerStatus {get;private set;}="Stopped";
        public string TunnelStatus {get;private set;}="Stopped";
        public bool ServerReady {get;private set;}
        public bool Active {get;private set;}
        public bool Busy {get;private set;}
        Process server,tunnel;ProcessJob job;
        string secret="";int generation;
        volatile bool serverReadySignal;
        readonly SynchronizationContext ui;
        public SessionController(){ui=SynchronizationContext.Current??new SynchronizationContext();}
        void Post(Action action){ui.Post(_=>action(),null);}
        void Notify(){if(Changed!=null)Changed();}
        void Log(string line){if(LogLine!=null)LogLine(LaunchRules.Redact(line,secret));}
        public string Clean(string line){return LaunchRules.Redact(line,secret);}
        public async Task StartAsync(Settings settings,string key,string root) {
            if(Busy||Active)return;
            string error=LaunchRules.Validate(settings,key,root);if(error!=null)throw new InvalidOperationException(error);
            Busy=true;secret=key;ServerStatus="Starting…";TunnelStatus="Waiting for calculator";Notify();
            int run=++generation;
            try {
                LaunchRules.CheckPort(8787);LaunchRules.CheckPort(8788);
                job=new ProcessJob();serverReadySignal=false;
                server=Start(LaunchRules.ServerInfo(root,settings),false,run);Active=true;
                var deadline=Stopwatch.StartNew();
                while(!serverReadySignal){if(server.HasExited)throw new IOException("The calculator stopped during startup. See Troubleshooting for its message.");if(deadline.ElapsedMilliseconds>20000)throw new IOException("The calculator did not finish starting within 20 seconds. See Troubleshooting.");await Task.Delay(100);}
                if(server.HasExited)throw new IOException("The calculator stopped during startup. See Troubleshooting.");
                ServerReady=true;ServerStatus="Running — map available";
                tunnel=Start(LaunchRules.TunnelInfo(root,settings,key),true,run);
                TunnelStatus="Running — awaiting service response";
                await Task.Delay(300);
                if(server.HasExited||tunnel.HasExited)throw new IOException("A background process stopped during startup. See Troubleshooting for its message.");
                Log("Started calculator and tunnel. Check the connection from ChatGPT; a running process alone does not confirm authentication.");
            }catch{await StopCore();ServerStatus="Could not start — see Troubleshooting";throw;}
            finally{Busy=false;Notify();}
        }
        Process Start(ProcessStartInfo info,bool isTunnel,int run) {
            var process=new Process{StartInfo=info,EnableRaisingEvents=true};
            DataReceivedEventHandler output=(sender,args)=>{
                if(args.Data==null)return;
                if(!isTunnel&&args.Data=="TABLETOP_LAUNCHER_READY"){serverReadySignal=true;return;}
                string line=LaunchRules.Redact(args.Data,secret);
                Post(()=>{
                    if(run!=generation)return;
                    Log((isTunnel?"Tunnel: ":"Calculator: ")+line);
                    if(isTunnel){
                        if(line.Contains("tunnel metadata fetched"))TunnelStatus="Registered — verify connection in ChatGPT";
                        else if(Regex.IsMatch(line,@"(?i)\b(ERROR|FATAL)\b|unauthorized|forbidden|status.?[=: ]+(401|403)"))TunnelStatus="Connection problem — see Troubleshooting";
                        Notify();
                    }
                });
            };
            process.OutputDataReceived+=output;process.ErrorDataReceived+=output;
            process.Exited+=(sender,args)=>Post(async()=>{
                if(run!=generation||Busy)return;
                if(isTunnel){TunnelStatus="Stopped unexpectedly — see Troubleshooting";Log("The tunnel exited. The local map remains available. Use Stop, then Start to reconnect.");Notify();}
                else{Log("The calculator exited unexpectedly; stopping its tunnel.");Busy=true;await StopCore();Busy=false;ServerStatus="Stopped unexpectedly — see Troubleshooting";Notify();}
            });
            try{process.Start();job.Add(process);process.BeginOutputReadLine();process.BeginErrorReadLine();return process;}
            catch{try{if(!process.HasExited)process.Kill();}catch{}process.Dispose();throw;}
            finally{info.EnvironmentVariables.Remove("CONTROL_PLANE_API_KEY");}
        }
        public async Task StopAsync(){if(Busy)return;Busy=true;ServerStatus="Stopping…";Notify();try{await StopCore();}finally{Busy=false;Notify();}}
        async Task StopCore(){
            ++generation;ServerReady=false;
            // Prevent new remote work, then let the kernel finish in-flight work and close its lock.
            if(tunnel!=null){try{if(!tunnel.HasExited)tunnel.Kill();}catch(Exception e){Log("Tunnel stop: "+e.Message);}await Wait(tunnel,1500);}
            if(server!=null){try{if(!server.HasExited){server.StandardInput.WriteLine("shutdown");server.StandardInput.Flush();}}catch{}await Wait(server,9500);}
            if(job!=null){job.Dispose();job=null;}
            if(server!=null){server.Dispose();server=null;}if(tunnel!=null){tunnel.Dispose();tunnel=null;}
            Active=false;secret="";ServerStatus="Stopped";TunnelStatus="Stopped";
        }
        static async Task Wait(Process p,int ms){var timer=Stopwatch.StartNew();try{while(!p.HasExited&&timer.ElapsedMilliseconds<ms)await Task.Delay(100);if(!p.HasExited)p.Kill();}catch(InvalidOperationException){}catch(Win32Exception){}}
        // Closing the owning window also closes the job if normal shutdown was interrupted.
        public void EmergencyClose(){if(job!=null){job.Dispose();job=null;}}
    }
}
