import base64
import unittest
from telegram.chat_media import decode_image


class ChatMediaTests(unittest.TestCase):
    def test_jpeg(self):
        sample = b"\xff\xd8\xff" + b"test"
        self.assertEqual(decode_image(base64.b64encode(sample).decode(), "image/jpeg"), sample)

    def test_reject_mime_spoof(self):
        with self.assertRaises(ValueError):
            decode_image(base64.b64encode(b"not an image").decode(), "image/png")

    def test_reject_unsupported(self):
        with self.assertRaises(ValueError):
            decode_image(base64.b64encode(b"GIF89a").decode(), "image/gif")

    def test_reject_invalid_base64(self):
        with self.assertRaises(ValueError):
            decode_image("$$$", "image/jpeg")

    def test_reject_large(self):
        with self.assertRaises(ValueError):
            decode_image("A" * (14 * 1024 * 1024 + 100), "image/jpeg")


if __name__ == "__main__":
    unittest.main()
