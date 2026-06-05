"""
Script to update evaluation dates across the last 7 days.
Spreads 14 evaluations (2 per day), sorted by overall rating score.
Highest scores get the most recent dates.
"""

import asyncio
from datetime import datetime, timedelta
from sqlalchemy import select, update
from app.db.session import AsyncSessionLocal
from app.db.models.evaluation_report import EvaluationReport


async def update_evaluation_dates():
    async with AsyncSessionLocal() as session:
        # Fetch all evaluations ordered by overall_rating DESC (highest first)
        result = await session.execute(
            select(EvaluationReport).order_by(EvaluationReport.evaluation_rating.desc().nullslast())
        )
        evaluations = result.scalars().all()

        if len(evaluations) != 14:
            print(f"Warning: Expected 14 evaluations, found {len(evaluations)}")

        today = datetime.now().replace(hour=12, minute=0, second=0, microsecond=0)

        # Assign dates: 2 evaluations per day for the last 7 days
        # Day 0 = today (highest scores), Day 6 = 6 days ago (lowest scores)
        for i, evaluation in enumerate(evaluations):
            day_offset = i // 2  # 0, 0, 1, 1, 2, 2, ...
            new_date = today - timedelta(days=day_offset)

            # Add some hour variation for the second evaluation of each day
            if i % 2 == 1:
                new_date = new_date.replace(hour=16)

            print(
                f"Updating evaluation {evaluation.id}: "
                f"rating={evaluation.evaluation_rating}, "
                f"old_date={evaluation.created_at}, "
                f"new_date={new_date}"
            )

            await session.execute(
                update(EvaluationReport).where(EvaluationReport.id == evaluation.id).values(created_at=new_date)
            )

        await session.commit()
        print(f"\nSuccessfully updated {len(evaluations)} evaluations")


if __name__ == "__main__":
    asyncio.run(update_evaluation_dates())
