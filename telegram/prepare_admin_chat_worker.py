#!/usr/bin/env python3
"""Prepare an isolated copy of the deployed legacy worker, preserving the original."""
import argparse
from pathlib import Path


def prepare(source):
    if 'from legacy_chat_bridge import start_chat' in source:
        raise ValueError('Chat bridge already installed')
    anchor = '    groups={}'
    if source.count(anchor) != 1 or source.count('"sender_name":""') != 1:
        raise ValueError('Worker structure differs; review before installing')
    result = source.replace(anchor, anchor + '\n    from legacy_chat_bridge import start_chat\n    chat_task = start_chat(client, user, key, groups, BASE)')
    result = result.replace('"sender_name":""', '"sender_name":"Đã gửi" if e.out else ""')
    compile(result, '<administrator-chat-worker>', 'exec')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve():
        parser.error('Output must be separate from the original worker')
    args.output.write_text(prepare(args.source.read_text()))
