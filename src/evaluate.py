"""Replay all 92 weeks under each policy and store the runs the API compares.

    python -m src.evaluate                 # all four policies
    python -m src.evaluate rules agent     # just these
"""

from __future__ import annotations

import argparse
import time

from . import config, policies, store
from .engine import Replay


def evaluate(policy: str) -> Replay:
    replay = Replay(policies.make(policy), mode="eval")
    replay.run()
    store.save(f"eval:{policy}", policy, "eval", replay, created_at=store.now())
    return replay


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("policies", nargs="*", metavar="policy",
                        help=f"any of {', '.join(config.POLICY_NAMES)} (default: all)")
    args = parser.parse_args(argv)
    unknown = set(args.policies) - set(config.POLICY_NAMES)
    if unknown:
        parser.error(f"unknown policy: {', '.join(sorted(unknown))}")
    for name in args.policies or config.POLICY_NAMES:
        if name == "agent" and not config.llm_configured():
            print("agent: OPENAI_API_KEY is not set, its LLM weeks will fall back to the rules")
        start = time.time()
        replay = evaluate(name)
        promotions = sum(e["event"] == "promote" and e["week"] >= 0 for e in replay.events)
        print(f"{name}: {len(replay.rows)} weeks, {len(replay.models) - 1} challengers, "
              f"{promotions} promotions ({time.time() - start:.0f}s)")


if __name__ == "__main__":
    main()
