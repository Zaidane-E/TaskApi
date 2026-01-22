using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskAPI.DTOs;
using TaskAPI.DTOs.Auth;
using TaskAPI.Models;
using TaskAPI.Services;

namespace TaskAPI.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IJwtService _jwtService;

    public AuthController(AppDbContext context, IJwtService jwtService)
    {
        _context = context;
        _jwtService = jwtService;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterDto dto)
    {
        if (await _context.Users.AnyAsync(u => u.Email == dto.Email))
            return BadRequest(new { message = "Email already registered" });

        var user = new User
        {
            Email = dto.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var token = _jwtService.GenerateToken(user);
        return Ok(new AuthResponseDto
        {
            Token = token,
            Email = user.Email,
            ExpiresAt = DateTime.UtcNow.AddHours(24)
        });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginDto dto)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
        if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
            return Unauthorized(new { message = "Invalid credentials" });

        var token = _jwtService.GenerateToken(user);
        return Ok(new AuthResponseDto
        {
            Token = token,
            Email = user.Email,
            ExpiresAt = DateTime.UtcNow.AddHours(24)
        });
    }

    [HttpPost("sync-guest-tasks")]
    [Authorize]
    public async Task<IActionResult> SyncGuestTasks(SyncTasksDto dto)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        foreach (var taskDto in dto.Tasks)
        {
            var task = new TaskItem
            {
                Title = taskDto.Title,
                Priority = taskDto.Priority,
                DueDate = taskDto.DueDate,
                UserId = userId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _context.Tasks.Add(task);
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = "Tasks synced successfully", count = dto.Tasks.Count });
    }
}
