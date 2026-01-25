namespace TaskAPI.Models;

public class AccountabilitySettings
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int GoalPercentage { get; set; } = 80;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
    public ICollection<Penalty> Penalties { get; set; } = new List<Penalty>();
    public ICollection<Reward> Rewards { get; set; } = new List<Reward>();
}

public class Penalty
{
    public int Id { get; set; }
    public int AccountabilitySettingsId { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    public AccountabilitySettings AccountabilitySettings { get; set; } = null!;
}

public class Reward
{
    public int Id { get; set; }
    public int AccountabilitySettingsId { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    public AccountabilitySettings AccountabilitySettings { get; set; } = null!;
}

public class AccountabilityLog
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public DateOnly Date { get; set; }
    public double CompletionRate { get; set; }
    public bool GoalMet { get; set; }
    public bool PenaltyApplied { get; set; }
    public bool RewardClaimed { get; set; }
    public int? AppliedPenaltyId { get; set; }
    public int? ClaimedRewardId { get; set; }

    public User User { get; set; } = null!;
}
