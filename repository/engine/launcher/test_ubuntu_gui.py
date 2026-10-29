"""Real Tk widgets on an available Linux display; disposable engine/tunnel fixtures."""
from pathlib import Path
import time
import tkinter as tk
import unittest
from unittest.mock import patch

from ubuntu_launcher import Launcher
from test_ubuntu_launcher import Tests, SECRET


class GuiTests(unittest.TestCase):
    def setUp(self):
        self.fixture = Tests()
        self.fixture.setUp()
        self.root = tk.Tk(className='PathfinderAssistant')
        self.app = Launcher(self.root, self.fixture.base / 'gui-settings')
        self.app.controller.close()
        self.app.controller = self.fixture.controller
        self.app.open_when_ready.set(False)
        for field, value in self.fixture.config.items():
            self.app.values[field].set(value)
        self.app.secret.set(SECRET)
        self.app.new_encounter = True
        self.root.update()

    def tearDown(self):
        self.fixture.tearDown()
        if not self.app.destroyed:
            self.app.lock.close()
            self.root.destroy()

    def spin(self, predicate, timeout=12):
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            if not self.app.destroyed:
                self.root.update()
            if predicate():
                return
            time.sleep(.02)
        raise AssertionError('GUI did not reach expected state: ' + self.app.status.get())

    def test_fields_mask_save_and_new_encounter_guard(self):
        self.assertEqual(self.app.secret_entry.cget('show'), '*')
        self.assertTrue(self.app.start_button.instate(['!disabled']))
        self.assertTrue(self.app.stop_button.instate(['disabled']))
        self.app.save()
        self.assertNotIn(SECRET, self.app.settings_file.read_text())
        target = self.fixture.base / 'existing.json'
        target.write_text('preserve')
        with patch('ubuntu_launcher.filedialog.asksaveasfilename', return_value=str(target)), patch('ubuntu_launcher.messagebox.showerror') as error:
            self.app.new_save()
            error.assert_called_once()
        self.assertEqual(target.read_text(), 'preserve')
        # Ensure actions and key field fit within the requested window.
        for widget in (self.app.secret_entry, self.app.start_button, self.app.map_button):
            self.assertGreater(widget.winfo_width(), 30)
            self.assertLessEqual(widget.winfo_rootx() - self.root.winfo_rootx() + widget.winfo_width(), self.root.winfo_width())
            self.assertLessEqual(widget.winfo_rooty() - self.root.winfo_rooty() + widget.winfo_height(), self.root.winfo_height())
        try:
            import os
            from PIL import ImageGrab
            ImageGrab.grab(xdisplay=os.environ.get('DISPLAY')).save('/tmp/pf-ubuntu-launcher-test.png')
        except ImportError:
            pass

    def test_failed_key_reconnect_stop_restart(self):
        (self.fixture.base / 'reject').touch()
        self.app.start_button.invoke()
        self.spin(lambda: not self.app.busy)
        self.assertIsNone(self.app.controller.engine.poll())
        self.assertTrue(self.app.reconnect_button.instate(['!disabled']))
        self.assertNotIn(SECRET, self.app.log.get('1.0', 'end'))
        self.assertIn('[REDACTED]', self.app.log.get('1.0', 'end'))
        engine_pid = self.app.controller.engine.pid
        (self.fixture.base / 'reject').unlink()
        self.app.reconnect_button.invoke()
        self.spin(lambda: not self.app.busy)
        self.assertEqual(self.app.controller.engine.pid, engine_pid)
        self.assertIsNone(self.app.controller.tunnel.poll())
        self.app.stop_button.invoke()
        self.spin(lambda: not self.app.busy)
        self.assertTrue(self.app.start_button.instate(['!disabled']))
        self.assertTrue(self.app.map_button.instate(['disabled']))
        self.app.start_button.invoke()
        self.spin(lambda: not self.app.busy)
        self.assertIsNone(self.app.controller.engine.poll())
        self.app.close()
        self.spin(lambda: self.app.destroyed)

    def test_close_during_start_completes_shutdown(self):
        self.app.start_button.invoke()
        self.assertTrue(self.app.busy)
        self.app.close()
        self.spin(lambda: self.app.destroyed)
        self.assertIsNone(self.app.controller.engine)
        self.assertIsNone(self.app.controller.tunnel)


if __name__ == '__main__':
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(GuiTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    raise SystemExit(not result.wasSuccessful())
