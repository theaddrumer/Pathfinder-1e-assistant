#!/usr/bin/env python3
"""WSLg window. Run the installer once; then launch from Windows Start."""
from pathlib import Path
import os
import queue
import signal
import sys
import threading
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

from ubuntu_core import (CONFIG_DIR, Controller, InstanceLock, load_settings,
                         save_settings, open_player_map)


class Launcher:
    def __init__(self, root, config_dir=CONFIG_DIR):
        self.root = root
        self.config_dir = Path(config_dir)
        self.settings_file = self.config_dir / 'settings.json'
        self.lock = InstanceLock(self.config_dir / 'launcher.lock')
        self.controller = Controller()
        self.busy = False
        self.closing = False
        self.destroyed = False
        self.root.title('Pathfinder Assistant — Ubuntu Launcher')
        self.root.geometry('850x590')
        self.root.minsize(800, 550)
        self.root.protocol('WM_DELETE_WINDOW', self.close)
        try:
            settings = load_settings(self.settings_file)
        except Exception as exc:
            messagebox.showerror('Settings', str(exc), parent=root)
            settings = {}
        self.values = {key: tk.StringVar(value=settings.get(key, '')) for key in
                       ('tunnel_id', 'organization_id', 'app_dir', 'node', 'tunnel', 'state_path')}
        self.secret = tk.StringVar()
        self.show_key = tk.BooleanVar(value=False)
        self.new_encounter = False
        self.status = tk.StringVar(value='Stopped')
        self.open_when_ready = tk.BooleanVar(value=True)
        self.build()
        self.root.after(150, self.poll)

    def build(self):
        outer = ttk.Frame(self.root, padding=18)
        outer.pack(fill='both', expand=True)
        ttk.Label(outer, text='Pathfinder Assistant', font=('sans-serif', 20, 'bold')).pack(anchor='w')
        ttk.Label(outer, text='Your calculator and OpenAI tunnel, running locally in Ubuntu.').pack(anchor='w', pady=(3, 14))
        notebook = ttk.Notebook(outer)
        notebook.pack(fill='both', expand=True)
        setup = ttk.Frame(notebook, padding=16)
        locations = ttk.Frame(notebook, padding=16)
        diagnostics = ttk.Frame(notebook, padding=12)
        notebook.add(setup, text='Connection')
        notebook.add(locations, text='Files & settings')
        notebook.add(diagnostics, text='Troubleshooting')
        self.notebook = notebook
        self.fields = []
        def entry(parent, row, label, variable, browse=None, secret=False):
            ttk.Label(parent, text=label).grid(row=row, column=0, sticky='w', pady=8)
            widget = ttk.Entry(parent, textvariable=variable, show='*' if secret else '')
            widget.grid(row=row, column=1, sticky='ew', padx=(12, 8), pady=8)
            self.fields.append(widget)
            if browse:
                button = ttk.Button(parent, text='Browse…', command=browse)
                button.grid(row=row, column=2)
                self.fields.append(button)
            parent.columnconfigure(1, weight=1)
            return widget
        entry(setup, 0, 'Tunnel ID', self.values['tunnel_id'])
        self.secret_entry = entry(setup, 1, 'API secret key', self.secret, secret=True)
        ttk.Checkbutton(setup, text='Show', variable=self.show_key,
                        command=lambda: self.secret_entry.configure(show='' if self.show_key.get() else '*')).grid(row=1, column=2)
        ttk.Label(setup, text='Use the full secret beginning sk-, not the Tracking ID or masked sk-... value.\nThe key stays in memory while this window is open. It is never saved to disk.',
                  wraplength=610).grid(row=2, column=0, columnspan=3, sticky='w', pady=(0, 18))
        entry(setup, 3, 'Organization ID (optional)', self.values['organization_id'])
        ttk.Checkbutton(setup, text='Open player map when the calculator starts',
                        variable=self.open_when_ready).grid(row=4, column=0, columnspan=3, sticky='w', pady=10)
        ttk.Label(setup, text='Before the first Start, stop your two manual Ubuntu processes with Ctrl+C.\nKeep this launcher window open while playing. Closing it stops its processes.',
                  wraplength=610).grid(row=5, column=0, columnspan=3, sticky='w', pady=8)
        for row, (field, label) in enumerate((('state_path', 'Encounter save'), ('app_dir', 'Calculator folder'),
                                             ('node', 'Linux Node program'), ('tunnel', 'Linux tunnel program'))):
            entry(locations, row, label, self.values[field], browse=lambda f=field: self.browse(f))
        ttk.Label(locations, text='Existing saves are reused. Windows files appear under /mnt/c in Ubuntu.\nChoose a different existing save with Browse; new encounters require the button below.',
                  wraplength=620).grid(row=4, column=0, columnspan=3, sticky='w', pady=10)
        self.new_button = ttk.Button(locations, text='New empty encounter…', command=self.new_save)
        self.new_button.grid(row=5, column=0, columnspan=2, sticky='w')
        self.save_button = ttk.Button(locations, text='Save settings', command=self.save)
        self.save_button.grid(row=5, column=2, sticky='e')
        self.fields.extend((self.new_button, self.save_button))
        self.log = tk.Text(diagnostics, height=13, wrap='word', state='disabled', font=('monospace', 9))
        scroll = ttk.Scrollbar(diagnostics, command=self.log.yview)
        self.log.configure(yscrollcommand=scroll.set)
        scroll.pack(side='right', fill='y')
        self.log.pack(fill='both', expand=True)
        ttk.Button(diagnostics, text='Copy redacted diagnostics', command=self.copy_log).pack(anchor='w', pady=(8, 0))
        ttk.Label(outer, textvariable=self.status, wraplength=720).pack(anchor='w', pady=(14, 10))
        actions = ttk.Frame(outer)
        actions.pack(fill='x')
        self.start_button = ttk.Button(actions, text='Start', command=self.start)
        self.stop_button = ttk.Button(actions, text='Stop', command=self.stop)
        self.reconnect_button = ttk.Button(actions, text='Reconnect tunnel', command=self.reconnect)
        self.map_button = ttk.Button(actions, text='Open player map', command=self.open_map)
        self.artwork_button = ttk.Button(actions, text='Map artwork', command=self.open_artwork)
        for button in (self.start_button, self.stop_button, self.reconnect_button, self.map_button, self.artwork_button):
            button.pack(side='left', padx=(0, 8))
        ttk.Button(actions, text='Close', command=self.close).pack(side='right')
        self.refresh_buttons()

    def config(self):
        return {key: value.get().strip() for key, value in self.values.items()}

    def browse(self, field):
        chooser = filedialog.askdirectory if field == 'app_dir' else filedialog.askopenfilename
        value = chooser(parent=self.root, initialdir=str(Path(self.values[field].get()).parent))
        if value:
            self.values[field].set(value)
            if field == 'state_path':
                self.new_encounter = False

    def new_save(self):
        value = filedialog.asksaveasfilename(parent=self.root, title='Create a new empty encounter',
                                            defaultextension='.json', initialfile='encounter-new.json')
        if value:
            if Path(value).exists():
                messagebox.showerror('Choose a new filename', 'This file already exists. Use Browse to load it; it will not be overwritten with an empty encounter.', parent=self.root)
                return
            self.values['state_path'].set(value)
            self.new_encounter = True

    def save(self):
        try:
            save_settings(self.settings_file, self.config())
            self.status.set('Settings saved. The API secret key is session-only.')
        except Exception as exc:
            messagebox.showerror('Settings', str(exc), parent=self.root)

    def work(self, task, open_map=False):
        if self.busy:
            return
        self.busy = True
        self.refresh_buttons()
        def worker():
            try:
                task()
                if open_map and self.controller.engine and self.controller.engine.poll() is None:
                    try:
                        open_player_map(self.controller.player_port)
                    except Exception as exc:
                        self.controller.emit('log', str(exc))
            except Exception as exc:
                self.controller.emit('error', str(exc))
            finally:
                self.controller.emit('done', '')
        threading.Thread(target=worker, daemon=True).start()

    def start(self):
        config, key, existing = self.config(), self.secret.get(), not self.new_encounter
        self.controller.redactor.add(key)
        def task():
            self.controller.start(config, key, require_existing=existing)
            save_settings(self.settings_file, config)
        self.work(task, open_map=self.open_when_ready.get())

    def reconnect(self):
        config, key = self.config(), self.secret.get()
        def task():
            self.controller.reconnect(config, key)
            save_settings(self.settings_file, config)
        self.work(task)

    def stop(self):
        self.work(self.controller.stop)

    def open_map(self):
        self.work(lambda: open_player_map(self.controller.player_port))

    def open_artwork(self):
        self.work(lambda: open_player_map(self.controller.engine_port, 'artwork'))

    def refresh_buttons(self):
        alive = bool(self.controller.engine and self.controller.engine.poll() is None)
        has_child = self.controller.engine is not None or self.controller.tunnel is not None
        for button, enabled in ((self.start_button, not alive), (self.stop_button, has_child),
                                (self.reconnect_button, alive), (self.map_button, alive), (self.artwork_button, alive)):
            button.configure(state='normal' if enabled and not self.busy and not self.closing else 'disabled')
        for widget in self.fields:
            # Connection credentials remain editable while running, so 401 is recoverable.
            widget.configure(state='disabled' if self.busy or self.closing else 'normal')

    def append_log(self, value):
        self.log.configure(state='normal')
        self.log.insert('end', value + '\n')
        count = len(self.log.get('1.0', 'end-1c'))
        if count > 40000:
            self.log.delete('1.0', f'1.0+{count - 40000}c')
        self.log.see('end')
        self.log.configure(state='disabled')

    def copy_log(self):
        self.root.clipboard_clear()
        self.root.clipboard_append(self.log.get('1.0', 'end-1c'))

    def poll(self):
        while True:
            try:
                kind, text = self.controller.events.get_nowait()
            except queue.Empty:
                break
            if kind == 'done':
                self.busy = False
                if self.closing:
                    self.finish_close()
                    if not self.destroyed:
                        self.root.after(150, self.poll)
                    return
            elif kind == 'status':
                self.status.set(text)
            elif kind == 'error':
                self.status.set(text)
                self.append_log(text)
                self.notebook.select(2)
            else:
                self.append_log(text)
        self.refresh_buttons()
        self.root.after(150, self.poll)

    def close(self):
        self.closing = True
        if not self.busy:
            self.finish_close()
        else:
            self.status.set('Finishing the current operation, then stopping…')

    def finish_close(self):
        if self.controller.engine is not None or self.controller.tunnel is not None:
            self.work(self.controller.stop)
            return
        self.secret.set('')
        self.controller.spawner.close()
        self.lock.close()
        self.destroyed = True
        self.root.destroy()


def main():
    root = None
    try:
        root = tk.Tk(className='PathfinderAssistant')
        app = Launcher(root)
        signal.signal(signal.SIGTERM, lambda *_: app.close())
        signal.signal(signal.SIGINT, lambda *_: app.close())
        root.mainloop()
    except Exception as exc:
        if root is not None:
            messagebox.showerror('Pathfinder Assistant', str(exc), parent=root)
            root.destroy()
        else:
            print('Could not open the Ubuntu window. WSL 2 GUI support and python3-tk are required.\n' + str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
