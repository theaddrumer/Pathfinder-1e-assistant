using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using TabletopLauncher;

public static class LauncherTests {
    static int passed;
    static void Check(bool yes,string label){if(!yes)throw new Exception(label);passed++;Console.WriteLine("PASS "+label);}
    public static int Main(){
        string root=Path.Combine(Path.GetTempPath(),"pf-launcher-test-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(root);
        string fake="sk-project-test-placeholder-only";
        try{
            Directory.CreateDirectory(Path.Combine(root,"runtime"));Directory.CreateDirectory(Path.Combine(root,"launcher"));
            File.WriteAllText(Path.Combine(root,"runtime","node.exe"),"");File.WriteAllText(Path.Combine(root,"launcher","launcher_host.mjs"),"");
            string tunnel=Path.Combine(root,"tunnel program.exe");File.WriteAllText(tunnel,"");
            var settings=new Settings{TunnelId="tunnel_"+new string('a',32),TunnelPath=tunnel,StatePath=Path.Combine(root,"encounter.json")};
            Check(LaunchRules.Validate(settings,fake,root)==null,"valid setup accepted");
            settings.TunnelId=fake;Check(LaunchRules.Validate(settings,fake,root).Contains("tunnel ID"),"key in tunnel field rejected");settings.TunnelId="tunnel_"+new string('a',32);
            Check(LaunchRules.Validate(settings,settings.TunnelId,root)!=null,"tunnel ID in key field rejected");
            Check(LaunchRules.Validate(settings,"has space",root)!=null,"whitespace key rejected");
            settings.StatePath="relative.json";Check(LaunchRules.Validate(settings,fake,root)!=null,"relative encounter path rejected");settings.StatePath=Path.Combine(root,"encounter.json");
            settings.OrganizationId="bad\r\nvalue";Check(LaunchRules.Validate(settings,fake,root)!=null,"invalid organization rejected");settings.OrganizationId="";
            Check(LaunchRules.Quote("C:\\My Tools\\node.exe")=="\"C:\\My Tools\\node.exe\"","Windows space quoting");
            Check(LaunchRules.Quote("a\"b\\")=="\"a\\\"b\\\\\"","Windows quote and trailing slash escaping");
            Check(LaunchRules.Redact("failed "+fake,fake)=="failed [key removed]","exact key redacted");
            Check(!LaunchRules.Redact("sk-project-old-secret",fake).Contains("old-secret"),"other key redacted");
            Check(!LaunchRules.Redact("Authorization: Bearer testsecret",fake).Contains("testsecret"),"bearer redacted");
            Check(LaunchRules.Redact(new string('x',9000),fake).Length<2600,"log line bounded");
            Environment.SetEnvironmentVariable("CONTROL_PLANE_API_KEY",fake);Environment.SetEnvironmentVariable("OPENAI_API_KEY",fake);Environment.SetEnvironmentVariable("NODE_OPTIONS","--inspect");Environment.SetEnvironmentVariable("TABLETOP_HOST","0.0.0.0");Environment.SetEnvironmentVariable("MCP_EXTRA_HEADERS","Authorization: secret");Environment.SetEnvironmentVariable("TUNNEL_CLIENT_CONFIG","bad.yaml");
            var node=LaunchRules.ServerInfo(root,settings);
            Check(node.EnvironmentVariables["CONTROL_PLANE_API_KEY"]==null&&node.EnvironmentVariables["OPENAI_API_KEY"]==null,"no key inherited by engine");
            Check(node.EnvironmentVariables["NODE_OPTIONS"]==null&&node.EnvironmentVariables["TABLETOP_HOST"]=="127.0.0.1","stale runtime options cleared and binding local");
            Check(!node.UseShellExecute&&node.CreateNoWindow&&node.RedirectStandardInput,"hidden process without command shell");
            var child=LaunchRules.TunnelInfo(root,settings,fake);
            Check(child.EnvironmentVariables["CONTROL_PLANE_API_KEY"]==fake&&!child.Arguments.Contains(fake),"key only in tunnel environment");
            Check(child.EnvironmentVariables["MCP_EXTRA_HEADERS"]==null&&child.EnvironmentVariables["TUNNEL_CLIENT_CONFIG"]==null,"stale tunnel config cleared");
            Check(child.Arguments.Contains("127.0.0.1:8787/mcp")&&child.Arguments.Contains("127.0.0.1:0"),"correct MCP route and collision-free health port");
            using(var socket=new Socket(AddressFamily.InterNetwork,SocketType.Stream,ProtocolType.Tcp)){
                socket.Bind(new IPEndPoint(IPAddress.Loopback,0));socket.Listen(1);int port=((IPEndPoint)socket.LocalEndPoint).Port;
                bool failed=false;try{LaunchRules.CheckPort(port);}catch(IOException){failed=true;}Check(failed,"port conflict detected without terminating owner");
                Check(socket.IsBound,"port owner preserved");
            }
            string path=Path.Combine(root,"settings.json");settings.RememberKey=false;SettingsStore.Save(path,settings,fake);
            Check(!File.ReadAllText(path).Contains(fake)&&SettingsStore.Load(path).ProtectedKey=="","session-only key never written");
            settings.OrganizationId="org-test";SettingsStore.Save(path,settings,fake);
            Check(SettingsStore.Load(path).OrganizationId=="org-test","atomic replacement preserves settings");
            Check(Directory.GetFiles(root,"*.tmp").Length==0,"settings temporary files cleaned");
            // DPAPI must be verified on Windows; do not treat Mono's implementation as proof.
            if(Environment.OSVersion.Platform==PlatformID.Win32NT){
                string cipher=SettingsStore.Protect(fake);Check(cipher!=fake&&SettingsStore.Unprotect(cipher)==fake,"Windows DPAPI round trip");
                settings.RememberKey=true;SettingsStore.Save(path,settings,fake);Check(!File.ReadAllText(path).Contains(fake),"saved credential encrypted");
                settings.RememberKey=false;SettingsStore.Save(path,settings,"");Check(SettingsStore.Load(path).ProtectedKey=="","forget removes persisted key");
            }else Console.WriteLine("SKIP Windows DPAPI: non-Windows host");
            Console.WriteLine(passed+" checks passed");return 0;
        }catch(Exception e){Console.Error.WriteLine(e);return 1;}finally{Directory.Delete(root,true);}
    }
}
