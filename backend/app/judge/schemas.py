from pydantic import BaseModel, Field
from typing import Literal


class RubricScores(BaseModel):
    accuracy: int = Field(ge=1, le=10)
    reasoning: int = Field(ge=1, le=10)
    clarity: int = Field(ge=1, le=10)
    completeness: int = Field(ge=1, le=10)

    @property
    def total(self) -> int:
        return self.accuracy + self.reasoning + self.clarity + self.completeness


class Verdict(BaseModel):
    winner: Literal["A", "B", "tie"]
    scores_a: RubricScores
    scores_b: RubricScores
    key_differences: list[str] = Field(min_length=3, max_length=5)
    reasoning: str

    @property
    def score_diff(self) -> int:
        return self.scores_a.total - self.scores_b.total
