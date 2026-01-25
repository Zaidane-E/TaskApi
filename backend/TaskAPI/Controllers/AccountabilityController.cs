using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskAPI.DTOs.Accountability;
using TaskAPI.Models;

namespace TaskAPI.Controllers;

[ApiController]
[Route("api/accountability")]
[Authorize]
public class AccountabilityController : ControllerBase
{
    private readonly AppDbContext _context;

    public AccountabilityController(AppDbContext context)
    {
        _context = context;
    }

    private int GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : 0;
    }

    private async Task<AccountabilitySettings> GetOrCreateSettings(int userId)
    {
        var settings = await _context.AccountabilitySettings
            .Include(s => s.Penalties)
            .Include(s => s.Rewards)
            .FirstOrDefaultAsync(s => s.UserId == userId);

        if (settings == null)
        {
            settings = new AccountabilitySettings
            {
                UserId = userId,
                GoalPercentage = 80,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _context.AccountabilitySettings.Add(settings);
            await _context.SaveChangesAsync();
        }

        return settings;
    }

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings()
    {
        var userId = GetUserId();
        var settings = await GetOrCreateSettings(userId);

        return Ok(new AccountabilitySettingsDto
        {
            GoalPercentage = settings.GoalPercentage,
            Penalties = settings.Penalties.Select(p => new PenaltyDto
            {
                Id = p.Id,
                Description = p.Description,
                CreatedAt = p.CreatedAt
            }).ToList(),
            Rewards = settings.Rewards.Select(r => new RewardDto
            {
                Id = r.Id,
                Description = r.Description,
                CreatedAt = r.CreatedAt
            }).ToList()
        });
    }

    [HttpPut("goal")]
    public async Task<IActionResult> UpdateGoal(UpdateGoalDto dto)
    {
        var userId = GetUserId();
        var settings = await GetOrCreateSettings(userId);

        settings.GoalPercentage = Math.Clamp(dto.GoalPercentage, 0, 100);
        settings.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { goalPercentage = settings.GoalPercentage });
    }

    [HttpPost("penalties")]
    public async Task<IActionResult> AddPenalty(CreatePenaltyDto dto)
    {
        var userId = GetUserId();
        var settings = await GetOrCreateSettings(userId);

        var penalty = new Penalty
        {
            AccountabilitySettingsId = settings.Id,
            Description = dto.Description,
            CreatedAt = DateTime.UtcNow
        };

        _context.Penalties.Add(penalty);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetSettings), new PenaltyDto
        {
            Id = penalty.Id,
            Description = penalty.Description,
            CreatedAt = penalty.CreatedAt
        });
    }

    [HttpDelete("penalties/{id}")]
    public async Task<IActionResult> RemovePenalty(int id)
    {
        var userId = GetUserId();
        var settings = await GetOrCreateSettings(userId);

        var penalty = await _context.Penalties
            .FirstOrDefaultAsync(p => p.Id == id && p.AccountabilitySettingsId == settings.Id);

        if (penalty == null)
            return NotFound();

        _context.Penalties.Remove(penalty);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("rewards")]
    public async Task<IActionResult> AddReward(CreateRewardDto dto)
    {
        var userId = GetUserId();
        var settings = await GetOrCreateSettings(userId);

        var reward = new Reward
        {
            AccountabilitySettingsId = settings.Id,
            Description = dto.Description,
            CreatedAt = DateTime.UtcNow
        };

        _context.Rewards.Add(reward);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetSettings), new RewardDto
        {
            Id = reward.Id,
            Description = reward.Description,
            CreatedAt = reward.CreatedAt
        });
    }

    [HttpDelete("rewards/{id}")]
    public async Task<IActionResult> RemoveReward(int id)
    {
        var userId = GetUserId();
        var settings = await GetOrCreateSettings(userId);

        var reward = await _context.Rewards
            .FirstOrDefaultAsync(r => r.Id == id && r.AccountabilitySettingsId == settings.Id);

        if (reward == null)
            return NotFound();

        _context.Rewards.Remove(reward);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("log/today")]
    public async Task<IActionResult> GetTodayLog()
    {
        var userId = GetUserId();
        var today = DateOnly.FromDateTime(DateTime.Now);

        var log = await _context.AccountabilityLogs
            .FirstOrDefaultAsync(l => l.UserId == userId && l.Date == today);

        if (log == null)
            return Ok(null);

        return Ok(MapToDto(log));
    }

    [HttpPost("log")]
    public async Task<IActionResult> CreateOrUpdateLog()
    {
        var userId = GetUserId();
        var today = DateOnly.FromDateTime(DateTime.Now);
        var settings = await GetOrCreateSettings(userId);

        // Calculate today's completion rate
        var habits = await _context.Habits
            .Include(h => h.Completions)
            .Where(h => h.UserId == userId && h.IsActive)
            .ToListAsync();

        var total = habits.Count;
        var completed = habits.Count(h => h.Completions.Any(c => c.CompletedDate == today));
        var completionRate = total > 0 ? (double)completed / total * 100 : 0;
        var goalMet = completionRate >= settings.GoalPercentage;

        var log = await _context.AccountabilityLogs
            .FirstOrDefaultAsync(l => l.UserId == userId && l.Date == today);

        if (log == null)
        {
            log = new AccountabilityLog
            {
                UserId = userId,
                Date = today,
                CompletionRate = completionRate,
                GoalMet = goalMet
            };
            _context.AccountabilityLogs.Add(log);
        }
        else
        {
            log.CompletionRate = completionRate;
            log.GoalMet = goalMet;
        }

        await _context.SaveChangesAsync();
        return Ok(MapToDto(log));
    }

    [HttpPost("log/penalty/{penaltyId}")]
    public async Task<IActionResult> ApplyPenalty(int penaltyId)
    {
        var userId = GetUserId();
        var today = DateOnly.FromDateTime(DateTime.Now);

        var log = await _context.AccountabilityLogs
            .FirstOrDefaultAsync(l => l.UserId == userId && l.Date == today);

        if (log == null)
            return NotFound(new { message = "No log for today. Create one first." });

        log.PenaltyApplied = true;
        log.AppliedPenaltyId = penaltyId;
        await _context.SaveChangesAsync();

        return Ok(MapToDto(log));
    }

    [HttpDelete("log/penalty")]
    public async Task<IActionResult> CancelPenalty()
    {
        var userId = GetUserId();
        var today = DateOnly.FromDateTime(DateTime.Now);

        var log = await _context.AccountabilityLogs
            .FirstOrDefaultAsync(l => l.UserId == userId && l.Date == today);

        if (log == null)
            return NotFound();

        log.PenaltyApplied = false;
        log.AppliedPenaltyId = null;
        await _context.SaveChangesAsync();

        return Ok(MapToDto(log));
    }

    [HttpPost("log/reward/{rewardId}")]
    public async Task<IActionResult> ClaimReward(int rewardId)
    {
        var userId = GetUserId();
        var today = DateOnly.FromDateTime(DateTime.Now);

        var log = await _context.AccountabilityLogs
            .FirstOrDefaultAsync(l => l.UserId == userId && l.Date == today);

        if (log == null)
            return NotFound(new { message = "No log for today. Create one first." });

        log.RewardClaimed = true;
        log.ClaimedRewardId = rewardId;
        await _context.SaveChangesAsync();

        return Ok(MapToDto(log));
    }

    [HttpDelete("log/reward")]
    public async Task<IActionResult> CancelReward()
    {
        var userId = GetUserId();
        var today = DateOnly.FromDateTime(DateTime.Now);

        var log = await _context.AccountabilityLogs
            .FirstOrDefaultAsync(l => l.UserId == userId && l.Date == today);

        if (log == null)
            return NotFound();

        log.RewardClaimed = false;
        log.ClaimedRewardId = null;
        await _context.SaveChangesAsync();

        return Ok(MapToDto(log));
    }

    private static AccountabilityLogDto MapToDto(AccountabilityLog log)
    {
        return new AccountabilityLogDto
        {
            Id = log.Id,
            Date = log.Date.ToString("yyyy-MM-dd"),
            CompletionRate = log.CompletionRate,
            GoalMet = log.GoalMet,
            PenaltyApplied = log.PenaltyApplied,
            RewardClaimed = log.RewardClaimed,
            AppliedPenaltyId = log.AppliedPenaltyId,
            ClaimedRewardId = log.ClaimedRewardId
        };
    }
}
