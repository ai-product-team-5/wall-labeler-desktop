from __future__ import annotations

import argparse
from dataclasses import dataclass
import json
import sys
from typing import Callable

from worker.corner_detection import detect_corners
from worker.io_utils import read_project_from_stdin
from worker.mask_export import export_mask

type CommandRunner = Callable[[argparse.Namespace], dict]
type ParserConfigurer = Callable[[argparse.ArgumentParser], None]


@dataclass(frozen=True, slots=True)
class CommandSpec:
    help: str
    configure_parser: ParserConfigurer
    run: CommandRunner


def configure_detect_corners_parser(parser: argparse.ArgumentParser) -> None:
    parser.add_argument('--image', required=True)
    parser.add_argument('--max-corners', type=int, default=800)


def run_detect_corners(args: argparse.Namespace) -> dict:
    return detect_corners(args.image, args.max_corners)


def configure_export_mask_parser(parser: argparse.ArgumentParser) -> None:
    parser.add_argument('--output', required=True)


def run_export_mask(args: argparse.Namespace) -> dict:
    project = read_project_from_stdin()
    return export_mask(project, args.output)


COMMAND_SPECS: dict[str, CommandSpec] = {
    'detect-corners': CommandSpec(
        help='detect snap corners',
        configure_parser=configure_detect_corners_parser,
        run=run_detect_corners,
    ),
    'export-mask': CommandSpec(
        help='export wall mask',
        configure_parser=configure_export_mask_parser,
        run=run_export_mask,
    ),
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='wall-labeler-desktop worker')
    subparsers = parser.add_subparsers(dest='command', required=True)

    for command_name, command_spec in COMMAND_SPECS.items():
        command_parser = subparsers.add_parser(command_name, help=command_spec.help)
        command_spec.configure_parser(command_parser)

    return parser


def run_command(args: argparse.Namespace) -> dict:
    command_spec = COMMAND_SPECS.get(args.command)
    if command_spec is None:
        raise ValueError(f'未知命令: {args.command}')

    return command_spec.run(args)


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    try:
        result = run_command(args)
    except Exception as exc:  # noqa: BLE001
        print(str(exc), file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False))
    return 0
