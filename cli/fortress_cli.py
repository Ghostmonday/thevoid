#!/usr/bin/env python3
"""
Fated Fortress CLI
Command-line interface for the Fortress Guild

Usage:
    fortress --help
    fortress status
    fortress quests list
    fortress quests create <title>
    fortress squads list
    fortress leaderboard
    fortress submit --quest-id <id> --content <content>
    fortress verify --quest-id <id>
"""

import argparse
import sys
import os
import json
import subprocess
from datetime import datetime
from pathlib import Path

# ANSI colors
class Colors:
    RESET = '\033[0m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    
    # Light theme colors (matching website)
    BG_PRIMARY = '\033[47m'
    TEXT_PRIMARY = '\033[34m'
    TEXT_SECONDARY = '\033[90m'
    ACCENT_GOLD = '\033[33m'
    ACCENT_WARM = '\033[38;5;130m'
    SUCCESS = '\033[32m'
    WARNING = '\033[38;5;130m'
    ERROR = '\033[31m'
    
    # Special
    BORDER = '\033[90m'
    HIGHTLIGHT = '\033[46m'

# Configuration
CONFIG_DIR = Path.home() / '.fortress'
CONFIG_FILE = CONFIG_DIR / 'config.json'
DATA_DIR = Path.home() / '.fortress' / 'data'

# ASCII Art
FORTRESS_ASCII = f"""
{Colors.ACCENT_GOLD}
    ╔═══════════════════════════════════════════════════════════╗
    ║  {Colors.BOLD}██╗   ██╗ ██████╗ ██╗██████╗     ███████╗██╗  ██╗ ██████╗ ██████╗ {Colors.RESET}{Colors.ACCENT_GOLD}║
    ║  {Colors.BOLD}██║   ██║██╔═══██╗██║██╔══██╗    ██╔════╝██║  ██║██╔═══██╗██╔══██╗{Colors.RESET}{Colors.ACCENT_GOLD} ║
    ║  {Colors.BOLD}██║   ██║██║   ██║██║██║  ██║    ███████╗███████║██║   ██║██████╔╝{Colors.RESET}{Colors.ACCENT_GOLD} ║
    ║  {Colors.BOLD}╚██╗ ██╔╝██║   ██║██║██║  ██║    ╚════██║██╔══██║██║   ██║██╔══██╗{Colors.RESET}{Colors.ACCENT_GOLD} ║
    ║   {Colors.BOLD}╚████╔╝ ╚██████╔╝██║██████╔╝    ███████║██║  ██║╚██████╔╝██║  ██║{Colors.RESET}{Colors.ACCENT_GOLD} ║
    ║    {Colors.BOLD}╚═══╝   ╚═════╝ ╚═╝╚═════╝     ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝{Colors.RESET}{Colors.ACCENT_GOLD} ║
    ╚═══════════════════════════════════════════════════════════╝
{Colors.RESET}
"""

DIVIDER = f"{Colors.BORDER}{'─' * 60}{Colors.RESET}"


def ensure_config():
    """Ensure config directory and files exist"""
    CONFIG_DIR.mkdir(exist_ok=True)
    DATA_DIR.mkdir(exist_ok=True)
    
    if not CONFIG_FILE.exists():
        config = {
            "user": {
                "id": None,
                "name": None,
                "squad": None
            },
            "api": {
                "endpoint": "http://localhost:3000",
                "key": None
            },
            "theme": "light"
        }
        CONFIG_FILE.write_text(json.dumps(config, indent=2))
    
    return json.loads(CONFIG_FILE.read_text())


def save_config(config):
    """Save configuration"""
    CONFIG_FILE.write_text(json.dumps(config, indent=2))


def cmd_status(args):
    """Show fortress status"""
    config = ensure_config()
    
    print(FORTRESS_ASCII)
    print(f"{Colors.BOLD}⚔ FATED FORTRESS CLI{Colors.RESET} | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(DIVIDER)
    
    # Show connection status
    print(f"\n{Colors.BOLD}Connection Status:{Colors.RESET}")
    print(f"  Endpoint: {config['api']['endpoint']}")
    print(f"  Theme:    {config['theme'].upper()}")
    
    # User info
    print(f"\n{Colors.BOLD}User:{Colors.RESET}")
    if config['user']['name']:
        print(f"  Name:   {config['user']['name']}")
        print(f"  Squad:  {config['user']['squad'] or 'None'}")
    else:
        print(f"  {Colors.WARNING}Not logged in - run 'fortress login'{Colors.RESET}")
    
    # Stats (mock for now)
    print(f"\n{Colors.BOLD}Fortress Stats:{Colors.RESET}")
    print(f"  🏰 Builders:  {Colors.ACCENT_GOLD}32{Colors.RESET}")
    print(f"  📜 Quests:    {Colors.ACCENT_GOLD}14{Colors.RESET}")
    print(f"  ⚔ REP:       {Colors.ACCENT_GOLD}634{Colors.RESET}")
    print(f"  ✅ Verify:    {Colors.ACCENT_GOLD}61%{Colors.RESET}")
    
    print(f"\n{Colors.BOLD}Quick Actions:{Colors.RESET}")
    print(f"  fortress quests list    - View all quests")
    print(f"  fortress squads list    - View all squads")
    print(f"  fortress leaderboard    - View top builders")
    print(f"  fortress quests create  - Create new quest")
    print()


def cmd_quests(args):
    """Quest management commands"""
    config = ensure_config()
    
    if args.quest_action == 'list':
        # Mock quests data
        quests = [
            {"id": "Q-001", "title": "Implement user authentication", "domain": "BACKEND", "bond": 30, "status": "OPEN", "assignee": "e394a..."},
            {"id": "Q-002", "title": "Design dashboard UI", "domain": "FRONTEND", "bond": 25, "status": "IN_PROGRESS", "assignee": "7d3c1..."},
            {"id": "Q-003", "title": "Setup CI/CD pipeline", "domain": "DEVOPS", "bond": 35, "status": "OPEN", "assignee": None},
            {"id": "Q-004", "title": "Write API documentation", "domain": "BACKEND", "bond": 20, "status": "COMPLETED", "assignee": "9a2b5..."},
            {"id": "Q-005", "title": "Optimize database queries", "domain": "BACKEND", "bond": 40, "status": "OPEN", "assignee": None},
        ]
        
        print(f"\n{Colors.BOLD}📜 ACTIVE QUESTS{Colors.RESET} ({len(quests)} total)")
        print(DIVIDER)
        
        # Table header
        print(f"{Colors.BORDER}ID{Colors.RESET:>6} │ {Colors.BORDER}Domain{Colors.RESET:>10} │ {Colors.BORDER}Title{Colors.RESET:>30} │ {Colors.BOND}Bond{Colors.RESET:>6} │ {Colors.STATUS}Status{Colors.RESET}")
        print(DIVIDER)
        
        for q in quests:
            status_color = Colors.SUCCESS if q['status'] == 'COMPLETED' else Colors.WARNING if q['status'] == 'IN_PROGRESS' else Colors.TEXT_SECONDARY
            domain_color = Colors.ACCENT_GOLD if q['domain'] == 'BACKEND' else Colors.ACCENT_WARM if q['domain'] == 'FRONTEND' else Colors.TEXT_SECONDARY
            
            print(f"{q['id']:>6} │ {domain_color}{q['domain']:>10}{Colors.RESET} │ {q['title'][:28]:>30} │ {q['bond']:>6} │ {status_color}{q['status']:>12}{Colors.RESET}")
        
        print()
        
    elif args.quest_action == 'create':
        if not args.title:
            print(f"{Colors.ERROR}Error: Quest title required{Colors.RESET}")
            print(f"Usage: fortress quests create --title \"Your quest title\" --domain BACKEND")
            sys.exit(1)
        
        domain = args.domain or "BACKEND"
        
        print(f"\n{Colors.BOLD}⚔ Creating New Quest{Colors.RESET}")
        print(DIVIDER)
        print(f"  Title:  {Colors.ACCENT_GOLD}{args.title}{Colors.RESET}")
        print(f"  Domain: {domain}")
        print(f"  Bond:   {args.bond or 25} REP")
        print(f"\n{Colors.SUCCESS}✓ Quest created successfully!{Colors.RESET}")
        print(f"  ID: Q-006")
        print()
        
    elif args.quest_action == 'show':
        print(f"\n{Colors.BOLD}Quest Details: {args.quest_id}{Colors.RESET}")
        print(DIVIDER)
        # Mock details
        print(f"  Title:       Implement user authentication")
        print(f"  Domain:      BACKEND")
        print(f"  Bond:        30 REP")
        print(f"  Status:      OPEN")
        print(f"  Assignee:    None")
        print(f"  Created:     2024-01-15")
        print(f"  Expires:     2024-01-22")
        print()


def cmd_squads(args):
    """Squad management commands"""
    squads = [
        {"name": "ALPHA", "members": 8, "score": 1247, "status": "ACTIVE"},
        {"name": "BRAVO", "members": 6, "score": 892, "status": "ACTIVE"},
        {"name": "CHARLIE", "members": 5, "score": 634, "status": "ACTIVE"},
        {"name": "DELTA", "members": 4, "score": 412, "status": "RECRUITING"},
    ]
    
    print(f"\n{Colors.BOLD}⚔ SQUADS{Colors.RESET}")
    print(DIVIDER)
    
    for s in squads:
        status_icon = "●" if s['status'] == 'ACTIVE' else "○"
        status_color = Colors.SUCCESS if s['status'] == 'ACTIVE' else Colors.WARNING
        
        print(f"  {Colors.ACCENT_GOLD}{s['name']:>10}{Colors.RESET} │ ")
        print(f"              Members: {s['members']} │ Score: {s['score']} │ {status_color}{status_icon} {s['status']}{Colors.RESET}")
    
    print()


def cmd_leaderboard(args):
    """Show leaderboard"""
    leaders = [
        {"rank": 1, "name": "e394a...f", "squad": "ALPHA", "rep": 1000, "quests": 12},
        {"rank": 2, "name": "7d3c1...a", "squad": "ALPHA", "rep": 1000, "quests": 11},
        {"rank": 3, "name": "6860a...b", "squad": "BRAVO", "rep": 892, "quests": 9},
        {"rank": 4, "name": "9a2b5...c", "squad": "CHARLIE", "rep": 756, "quests": 8},
        {"rank": 5, "name": "2b4d6...d", "squad": "BRAVO", "rep": 634, "quests": 7},
    ]
    
    print(f"\n{Colors.BOLD}👑 LEADERBOARD{Colors.RESET}")
    print(DIVIDER)
    
    for l in leaders:
        rank_emoji = "🥇" if l['rank'] == 1 else "🥈" if l['rank'] == 2 else "🥉" if l['rank'] == 3 else "  "
        print(f"  {rank_emoji} #{l['rank']} {Colors.ACCENT_GOLD}{l['name']:>12}{Colors.RESET} [{l['squad']:>7}] │ REP: {l['rep']:>5} │ Quests: {l['quests']}")
    
    print()


def cmd_submit(args):
    """Submit work for a quest"""
    if not args.quest_id or not args.content:
        print(f"{Colors.ERROR}Error: Both --quest-id and --content required{Colors.RESET}")
        sys.exit(1)
    
    print(f"\n{Colors.BOLD}📤 Submitting Work{Colors.RESET}")
    print(DIVIDER)
    print(f"  Quest ID:  {args.quest_id}")
    print(f"  Content:   {args.content[:50]}...")
    print(f"\n{Colors.SUCCESS}✓ Submission received!{Colors.RESET}")
    print(f"  Transaction ID: {datetime.now().strftime('%Y%m%d%H%M%S')}")
    print()


def cmd_verify(args):
    """Verify a submission"""
    if not args.quest_id:
        print(f"{Colors.ERROR}Error: --quest-id required{Colors.RESET}")
        sys.exit(1)
    
    print(f"\n{Colors.BOLD}✅ Verifying Quest: {args.quest_id}{Colors.RESET}")
    print(DIVIDER)
    print(f"  Status: VERIFIED")
    print(f"  Reward: 30 REP")
    print(f"\n{Colors.SUCCESS}✓ Verification complete!{Colors.RESET}")
    print()


def cmd_login(args):
    """Login to fortress"""
    config = ensure_config()
    
    if args.name:
        config['user']['name'] = args.name
        save_config(config)
        print(f"\n{Colors.SUCCESS}✓ Logged in as {args.name}{Colors.RESET}")
    else:
        print(f"\n{Colors.BOLD}Current user:{Colors.RESET}")
        print(f"  Name: {config['user']['name'] or 'Not set'}")
    print()


def main():
    parser = argparse.ArgumentParser(
        description=f"{Colors.BOLD}⚔ Fated Fortress CLI{Colors.RESET} - Manage your guild from the command line",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  fortress status                    Show fortress status
  fortress quests list               List all quests
  fortress quests create --title "Build API" --domain BACKEND
  fortress squads list               List all squads
  fortress leaderboard               Show top builders
  fortress submit --quest-id Q-001 --content "Implemented auth"
  fortress verify --quest-id Q-001
  fortress login --name "YourName"
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Status command
    subparsers.add_parser('status', help='Show fortress status')
    
    # Quests command
    quest_parser = subparsers.add_parser('quests', help='Quest management')
    quest_sub = quest_parser.add_subparsers(dest='quest_action')
    
    quest_list = quest_sub.add_parser('list', help='List all quests')
    
    quest_create = quest_sub.add_parser('create', help='Create new quest')
    quest_create.add_argument('--title', required=True, help='Quest title')
    quest_create.add_argument('--domain', choices=['BACKEND', 'FRONTEND', 'DEVOPS'], default='BACKEND')
    quest_create.add_argument('--bond', type=int, default=25, help='Bond amount')
    
    quest_show = quest_sub.add_parser('show', help='Show quest details')
    quest_show.add_argument('quest_id', help='Quest ID')
    
    # Squads command
    squads_parser = subparsers.add_parser('squads', help='Squad management')
    squads_sub = squads_parser.add_subparsers(dest='squad_action')
    squads_sub.add_parser('list', help='List all squads')
    
    # Leaderboard
    subparsers.add_parser('leaderboard', help='Show leaderboard')
    
    # Submit
    submit_parser = subparsers.add_parser('submit', help='Submit work')
    submit_parser.add_argument('--quest-id', required=True, help='Quest ID')
    submit_parser.add_argument('--content', required=True, help='Submission content')
    
    # Verify
    verify_parser = subparsers.add_parser('verify', help='Verify a quest')
    verify_parser.add_argument('--quest-id', required=True, help='Quest ID')
    
    # Login
    login_parser = subparsers.add_parser('login', help='Login to fortress')
    login_parser.add_argument('--name', help='Your name')
    
    args = parser.parse_args()
    
    if not args.command:
        # Show status by default
        cmd_status(args)
        return
    
    # Route commands
    if args.command == 'status':
        cmd_status(args)
    elif args.command == 'quests':
        cmd_quests(args)
    elif args.command == 'squads':
        cmd_squads(args)
    elif args.command == 'leaderboard':
        cmd_leaderboard(args)
    elif args.command == 'submit':
        cmd_submit(args)
    elif args.command == 'verify':
        cmd_verify(args)
    elif args.command == 'login':
        cmd_login(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
