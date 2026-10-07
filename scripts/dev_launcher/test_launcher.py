"""模拟环境与端口，测试失败处理，不安装依赖或结束真实进程。"""
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch

from .environment import configure, ensure_dependencies
from .ports import release_port


class LauncherTests(unittest.TestCase):
    def test_check_does_not_create_env(self):
        """只检测模式不能写配置或初始化目录。"""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertEqual(configure(root, True), (5173, 3000))
            self.assertFalse((root / 'ui').exists())

    @patch('scripts.dev_launcher.environment.dependency_fingerprint', return_value='test')
    @patch('scripts.dev_launcher.environment.run')
    def test_no_install_reports_missing_dependencies(self, run, _fingerprint):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError, '依赖缺失'):
                ensure_dependencies(Path(directory), 'pnpm', True, False)
            run.assert_not_called()

    @patch('scripts.dev_launcher.ports.listeners', return_value={1234})
    @patch('scripts.dev_launcher.ports.identity', return_value='2026-10-07 OtherApplication')
    @patch('scripts.dev_launcher.ports.terminate')
    def test_check_never_terminates(self, terminate, _identity, _listeners):
        with self.assertRaisesRegex(RuntimeError, '不自动释放'):
            release_port(5173, check=True)
        terminate.assert_not_called()

    @patch('scripts.dev_launcher.ports.listeners', side_effect=[{1234}, {1234}, set(), set(), set(), set()])
    @patch('scripts.dev_launcher.ports.identity', return_value='2026-10-07 OtherApplication')
    @patch('scripts.dev_launcher.ports.terminate')
    def test_other_application_released_automatically(self, terminate, _identity, _listeners):
        release_port(5173)
        terminate.assert_called_once_with(1234, False)

    @patch('scripts.dev_launcher.ports.listeners', return_value={1234})
    @patch('scripts.dev_launcher.ports.identity', side_effect=['old process', 'new process'])
    @patch('scripts.dev_launcher.ports.terminate')
    def test_pid_reuse_is_rejected(self, terminate, _identity, _listeners):
        with self.assertRaisesRegex(RuntimeError, '身份发生变化'):
            release_port(5173)
        terminate.assert_not_called()


if __name__ == '__main__':
    unittest.main()
