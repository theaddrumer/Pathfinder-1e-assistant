using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("Tabletop Launcher")]
[assembly: AssemblyDescription("Windows launcher for Tabletop Kernel and its local tunnel")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

namespace TabletopLauncher {
    public sealed class LauncherForm:Form {
        readonly string root=AppDomain.CurrentDomain.BaseDirectory;
        readonly TextBox tunnelId=new TextBox(),apiKey=new TextBox(),tunnelPath=new TextBox(),organization=new TextBox(),statePath=new TextBox();
        readonly CheckBox remember=new CheckBox{Text="Remember API key for this Windows account",Checked=true,AutoSize=true};
        readonly Button start=new Button{Text="Start",Width=125,Height=36},stop=new Button{Text="Stop",Width=100,Height=36},map=new Button{Text="Open player map",Width=155,Height=36};
        readonly Label serverStatus=new Label{AutoSize=true},tunnelStatus=new Label{AutoSize=true};
        readonly TextBox details=new TextBox{Multiline=true,ReadOnly=true,ScrollBars=ScrollBars.Vertical,Dock=DockStyle.Fill,Font=new Font("Consolas",9)};
        readonly Panel setup=new Panel{Dock=DockStyle.Fill,AutoScroll=true};
        readonly TabControl tabs=new TabControl{Dock=DockStyle.Fill};
        SessionController controller;
        bool allowClose,closeRequested;
        string loadWarning;
        public LauncherForm() {
            Text="Tabletop Kernel — Launcher";ClientSize=new Size(760,650);MinimumSize=new Size(720,620);
            StartPosition=FormStartPosition.CenterScreen;Font=new Font("Segoe UI",10);AutoScaleMode=AutoScaleMode.Dpi;
            BackColor=Color.FromArgb(246,248,251);
            var frame=new TableLayoutPanel{Dock=DockStyle.Fill,Padding=new Padding(22),ColumnCount=1,RowCount=5};
            frame.RowStyles.Add(new RowStyle(SizeType.Absolute,40));frame.RowStyles.Add(new RowStyle(SizeType.Absolute,37));
            frame.RowStyles.Add(new RowStyle(SizeType.Absolute,65));frame.RowStyles.Add(new RowStyle(SizeType.Percent,100));frame.RowStyles.Add(new RowStyle(SizeType.Absolute,60));
            frame.Controls.Add(new Label{Text="Tabletop Kernel",AutoSize=true,Font=new Font("Segoe UI",22,FontStyle.Bold)},0,0);
            frame.Controls.Add(new Label{Text="Start your calculator and AI connection in one place.",AutoSize=true,ForeColor=Color.DimGray},0,1);
            var statusPanel=new FlowLayoutPanel{Dock=DockStyle.Fill,FlowDirection=FlowDirection.TopDown,WrapContents=false};
            statusPanel.Controls.Add(serverStatus);statusPanel.Controls.Add(tunnelStatus);frame.Controls.Add(statusPanel,0,2);
            var settingsTab=new TabPage("Connection");settingsTab.Controls.Add(setup);tabs.TabPages.Add(settingsTab);
            var settings=new TableLayoutPanel{Dock=DockStyle.Top,AutoSize=true,ColumnCount=3,Padding=new Padding(12)};
            settings.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,125));settings.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));settings.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,90));
            AddField(settings,0,"Tunnel ID",tunnelId,null);AddNote(settings,1,"Starts with tunnel_ — this is different from your API key.");
            apiKey.UseSystemPasswordChar=true;
            var show=new Button{Text="Show",Dock=DockStyle.Fill};show.Click+=(s,e)=>{apiKey.UseSystemPasswordChar=!apiKey.UseSystemPasswordChar;show.Text=apiKey.UseSystemPasswordChar?"Show":"Hide";};
            AddField(settings,2,"API key",apiKey,show);
            settings.Controls.Add(remember,1,3);settings.SetColumnSpan(remember,2);remember.Margin=new Padding(3,8,3,10);
            var browse=new Button{Text="Browse…",Dock=DockStyle.Fill};browse.Click+=(s,e)=>{
                using(var dialog=new OpenFileDialog{Title="Choose your tunnel-client-runtime.exe",Filter="Tunnel application (*.exe)|*.exe",CheckFileExists=true})if(dialog.ShowDialog(this)==DialogResult.OK)tunnelPath.Text=dialog.FileName;
            };
            AddField(settings,4,"Tunnel program",tunnelPath,browse);AddNote(settings,5,"Choose the tunnel-client-runtime.exe you already downloaded.");
            var saveRow=new FlowLayoutPanel{AutoSize=true,Dock=DockStyle.Fill};
            var save=new Button{Text="Save settings",AutoSize=true};save.Click+=(s,e)=>{try{SaveSettings();MessageBox.Show(this,"Settings saved.","Tabletop Kernel",MessageBoxButtons.OK,MessageBoxIcon.Information);}catch(Exception x){ShowError(x);}};
            var forget=new Button{Text="Forget saved key",AutoSize=true};forget.Click+=(s,e)=>{try{
                // Remove the persisted key even if other unsaved fields are currently incomplete.
                Settings old=SettingsStore.Load(SettingsStore.FilePath);old.RememberKey=false;
                SettingsStore.Save(SettingsStore.FilePath,old,"");apiKey.Clear();remember.Checked=false;Append("Saved API key removed from this Windows account.");
            }catch(Exception x){ShowError(x);}};
            saveRow.Controls.Add(save);saveRow.Controls.Add(forget);settings.Controls.Add(saveRow,1,6);settings.SetColumnSpan(saveRow,2);
            setup.Controls.Add(settings);
            var more=new TabPage("More settings");var morePanel=new TableLayoutPanel{Dock=DockStyle.Top,AutoSize=true,ColumnCount=3,Padding=new Padding(12)};
            morePanel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,125));morePanel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));morePanel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,90));
            AddField(morePanel,0,"Organization ID",organization,null);AddNote(morePanel,1,"Optional. Leave blank unless your tunnel setup requires an organization ID.");
            var chooseState=new Button{Text="Browse…",Dock=DockStyle.Fill};chooseState.Click+=(s,e)=>{
                using(var dialog=new SaveFileDialog{Title="Choose the encounter save to use",Filter="Encounter JSON (*.json)|*.json",FileName="encounter.json",OverwritePrompt=false})if(dialog.ShowDialog(this)==DialogResult.OK)statePath.Text=dialog.FileName;
            };
            AddField(morePanel,2,"Encounter save",statePath,chooseState);AddNote(morePanel,3,"Defaults to your existing calculator save. Changing this selects a different encounter; it does not copy or reset the old one.");
            var folder=new Button{Text="Open save folder",AutoSize=true};folder.Click+=(s,e)=>{try{string path=Path.GetDirectoryName(Path.GetFullPath(statePath.Text));Directory.CreateDirectory(path);Open(path);}catch(Exception x){ShowError(x);}};
            morePanel.Controls.Add(folder,1,4);AddNote(morePanel,5,"Local map: http://127.0.0.1:8788/player\nAI endpoint: http://127.0.0.1:8787/mcp\nThe player map is available on this computer only.");
            more.Controls.Add(morePanel);tabs.TabPages.Add(more);
            var logTab=new TabPage("Troubleshooting");var logPanel=new TableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=1,RowCount=3,Padding=new Padding(10)};
            logPanel.RowStyles.Add(new RowStyle(SizeType.Absolute,50));logPanel.RowStyles.Add(new RowStyle(SizeType.Percent,100));logPanel.RowStyles.Add(new RowStyle(SizeType.Absolute,36));
            logPanel.Controls.Add(new Label{Text="Recent messages appear here. API keys are removed. Messages may still include local paths or encounter error details; review before sharing.",Dock=DockStyle.Fill},0,0);
            logPanel.Controls.Add(details,0,1);var copy=new Button{Text="Copy messages",AutoSize=true};copy.Click+=(s,e)=>{if(details.Text.Length>0)Clipboard.SetText(details.Text);};logPanel.Controls.Add(copy,0,2);logTab.Controls.Add(logPanel);tabs.TabPages.Add(logTab);
            frame.Controls.Add(tabs,0,3);
            var actions=new FlowLayoutPanel{Dock=DockStyle.Fill,Padding=new Padding(0,14,0,0)};actions.Controls.Add(start);actions.Controls.Add(stop);actions.Controls.Add(map);
            var help=new Button{Text="Help",Width=75,Height=36};help.Click+=(s,e)=>Open(Path.Combine(root,"START_HERE_WINDOWS.txt"));actions.Controls.Add(help);frame.Controls.Add(actions,0,4);Controls.Add(frame);
            LoadSettings();
            Load+=(s,e)=>{controller=new SessionController();controller.Changed+=RefreshState;controller.LogLine+=Append;RefreshState();if(loadWarning!=null)Append(loadWarning);};
            start.Click+=async(s,e)=>{try{SaveSettings();await controller.StartAsync(ReadSettings(),apiKey.Text.Trim(),root);}catch(Exception x){ShowError(x);}finally{RefreshState();}};
            stop.Click+=async(s,e)=>{try{await controller.StopAsync();}catch(Exception x){ShowError(x);}finally{RefreshState();}};
            map.Click+=(s,e)=>Open("http://127.0.0.1:8788/player");
            FormClosing+=async(s,e)=>{if(allowClose||controller==null)return;e.Cancel=true;if(controller.Busy){closeRequested=true;return;}
                try{await controller.StopAsync();}catch{}finally{controller.EmergencyClose();allowClose=true;Close();}};
        }
        static void AddField(TableLayoutPanel p,int row,string title,TextBox input,Control button) {
            p.RowStyles.Add(new RowStyle(SizeType.AutoSize));var label=new Label{Text=title,AutoSize=true,Anchor=AnchorStyles.Left,Margin=new Padding(3,8,3,8)};
            input.Dock=DockStyle.Fill;input.Margin=new Padding(3,6,6,6);p.Controls.Add(label,0,row);p.Controls.Add(input,1,row);if(button!=null){button.Margin=new Padding(3,5,3,5);p.Controls.Add(button,2,row);}else p.SetColumnSpan(input,2);
        }
        static void AddNote(TableLayoutPanel p,int row,string text){var note=new Label{Text=text,AutoSize=true,MaximumSize=new Size(490,0),ForeColor=Color.DimGray,Margin=new Padding(3,1,3,12)};p.Controls.Add(note,1,row);p.SetColumnSpan(note,2);}
        Settings ReadSettings(){return new Settings{TunnelId=tunnelId.Text.Trim(),OrganizationId=organization.Text.Trim(),TunnelPath=tunnelPath.Text.Trim(),StatePath=statePath.Text.Trim(),RememberKey=remember.Checked};}
        void SaveSettings(){Settings s=ReadSettings();string error=LaunchRules.Validate(s,apiKey.Text.Trim(),root);if(error!=null)throw new InvalidOperationException(error);SettingsStore.Save(SettingsStore.FilePath,s,apiKey.Text.Trim());}
        void LoadSettings(){
            Settings s=new Settings();
            try{s=SettingsStore.Load(SettingsStore.FilePath);if(s.RememberKey)apiKey.Text=SettingsStore.Unprotect(s.ProtectedKey);}
            catch(Exception){loadWarning="Saved settings or key could not be read. Re-enter the API key if needed; your encounter save has not been changed.";}
            tunnelId.Text=s.TunnelId??"";organization.Text=s.OrganizationId??"";tunnelPath.Text=s.TunnelPath??"";statePath.Text=s.StatePath??new Settings().StatePath;remember.Checked=s.RememberKey;
            if(String.IsNullOrEmpty(tunnelPath.Text)){foreach(string relative in new[]{"tunnel-client-runtime.exe",Path.Combine("Tunnel Client","tunnel-client-runtime.exe")}){string candidate=Path.Combine(root,relative);if(File.Exists(candidate)){tunnelPath.Text=candidate;break;}}}
        }
        void RefreshState(){if(controller==null)return;serverStatus.Text="Calculator: "+controller.ServerStatus;tunnelStatus.Text="AI tunnel: "+controller.TunnelStatus;start.Enabled=!controller.Active&&!controller.Busy;stop.Enabled=controller.Active&&!controller.Busy;map.Enabled=controller.ServerReady&&!controller.Busy;setup.Enabled=!controller.Active&&!controller.Busy;tabs.TabPages[1].Enabled=!controller.Active&&!controller.Busy;if(closeRequested&&!controller.Busy){closeRequested=false;BeginInvoke(new Action(Close));}}
        void Append(string line){details.AppendText(DateTime.Now.ToString("HH:mm:ss")+"  "+line+Environment.NewLine);if(details.TextLength>40000)details.Text=details.Text.Substring(details.TextLength-30000);details.SelectionStart=details.TextLength;details.ScrollToCaret();}
        void ShowError(Exception e){string message=LaunchRules.Redact(e.Message,apiKey.Text.Trim());Append(message);tabs.SelectedIndex=2;MessageBox.Show(this,message,"Tabletop Kernel",MessageBoxButtons.OK,MessageBoxIcon.Warning);}
        void Open(string target){try{Process.Start(new ProcessStartInfo(target){UseShellExecute=true});}catch(Exception e){ShowError(e);}}
        [STAThread] public static void Main(){
            bool first;
            using(var mutex=new Mutex(true,"Local\\TabletopKernel.WindowsLauncher.v1",out first)){
                if(!first){MessageBox.Show("Tabletop Launcher is already open. Switch to its existing window.","Tabletop Kernel");return;}
                Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new LauncherForm());GC.KeepAlive(mutex);
            }
        }
    }
}
