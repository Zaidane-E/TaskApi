namespace TaskAPI.DTOs.Accountability;

public class AccountabilitySettingsDto
{
    public int GoalPercentage { get; set; }
    public List<PenaltyDto> Penalties { get; set; } = new();
    public List<RewardDto> Rewards { get; set; } = new();
}

public class PenaltyDto
{
    public int Id { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class RewardDto
{
    public int Id { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class AccountabilityLogDto
{
    public int Id { get; set; }
    public string Date { get; set; } = string.Empty;
    public double CompletionRate { get; set; }
    public bool GoalMet { get; set; }
    public bool PenaltyApplied { get; set; }
    public bool RewardClaimed { get; set; }
    public int? AppliedPenaltyId { get; set; }
    public int? ClaimedRewardId { get; set; }
}

public class UpdateGoalDto
{
    public int GoalPercentage { get; set; }
}

public class CreatePenaltyDto
{
    public string Description { get; set; } = string.Empty;
}

public class CreateRewardDto
{
    public string Description { get; set; } = string.Empty;
}
