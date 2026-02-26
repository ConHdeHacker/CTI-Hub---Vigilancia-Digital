from typing import List
from ..schemas import ProviderEvidence

class ScoringService:
    def calculate(self, evidences: List[ProviderEvidence]) -> float:
        if not evidences:
            return 0.0
        
        # Simple weighted average or max score
        # For this implementation, we take the maximum score found
        scores = [e.score for e in evidences]
        return max(scores) if scores else 0.0

scoring_service = ScoringService()
