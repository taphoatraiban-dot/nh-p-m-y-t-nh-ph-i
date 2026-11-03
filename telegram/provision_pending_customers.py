#!/usr/bin/env python3
"""Find consented customers without workers and provision individually."""
import re
import subprocess
from pathlib import Path
from provision_selfservice_customer import provision

SOURCE = Path("/var/lib/ongthantai-telegram-sessions")
CONFIG = Path("/etc/ongthantai-telegram/tenants")
UUID = re.compile(r"^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$")
def main():
    successes = failures = 0
    for file in sorted(SOURCE.glob("*.groups.json")):
        uid = file.name.removesuffix(".groups.json")
        if not UUID.fullmatch(uid) or not (SOURCE / (uid + ".session.enc")).is_file():
            continue
        if (CONFIG / (uid + ".json")).exists():
            unit = "ongthantai-tenant@" + uid + ".service"
            if subprocess.run(["systemctl", "is-active", "--quiet", unit], check=False).returncode == 0:
                continue
        try:
            provision(uid)
            successes += 1
        except Exception as exc:
            failures += 1
            print("SKIPPED:", uid[:8] + "…", type(exc).__name__)
    print("SCAN_COMPLETE:", successes, "successful;", failures, "skipped")
if __name__ == "__main__":
    main()
