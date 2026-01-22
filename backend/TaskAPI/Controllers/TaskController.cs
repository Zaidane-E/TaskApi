using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace TaskAPI.Controllers;

[ApiController]
[Route("api/tasks")]
[Authorize]
public class TasksController : ControllerBase
{
    private readonly AppDbContext _context;

    public TasksController(AppDbContext context)
    {
        _context = context;
    }

    private int GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : 0;
    }

    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] bool? isCompleted = null,
        [FromQuery] Priority? priority = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortOrder = "desc")
    {
        var userId = GetUserId();
        var query = _context.Tasks.Where(t => t.UserId == userId);

        if (isCompleted.HasValue)
            query = query.Where(t => t.IsCompleted == isCompleted.Value);

        if (priority.HasValue)
            query = query.Where(t => t.Priority == priority.Value);

        query = (sortBy?.ToLower(), sortOrder?.ToLower()) switch
        {
            ("priority", "asc") => query.OrderBy(t => t.Priority),
            ("priority", _) => query.OrderByDescending(t => t.Priority),
            ("duedate", "asc") => query.OrderBy(t => t.DueDate),
            ("duedate", _) => query.OrderByDescending(t => t.DueDate),
            ("createdat", "asc") => query.OrderBy(t => t.CreatedAt),
            _ => query.OrderByDescending(t => t.CreatedAt)
        };

        var tasks = await query.ToListAsync();
        return Ok(tasks);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var userId = GetUserId();
        var task = await _context.Tasks.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
        if (task == null)
            return NotFound();
        return Ok(task);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateTaskDto dto)
    {
        var userId = GetUserId();
        var task = new TaskItem
        {
            Title = dto.Title,
            Priority = dto.Priority,
            DueDate = dto.DueDate,
            UserId = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _context.Tasks.Add(task);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = task.Id }, task);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, UpdateTaskDto dto)
    {
        var userId = GetUserId();
        var task = await _context.Tasks.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
        if (task == null)
            return NotFound();

        var wasCompleted = task.IsCompleted;
        task.Title = dto.Title;
        task.IsCompleted = dto.IsCompleted;
        task.Priority = dto.Priority;
        task.DueDate = dto.DueDate;
        task.UpdatedAt = DateTime.UtcNow;

        if (!wasCompleted && dto.IsCompleted)
            task.CompletedAt = DateTime.UtcNow;
        else if (wasCompleted && !dto.IsCompleted)
            task.CompletedAt = null;

        await _context.SaveChangesAsync();
        return Ok(task);
    }

    [HttpPatch("{id}/toggle")]
    public async Task<IActionResult> ToggleComplete(int id)
    {
        var userId = GetUserId();
        var task = await _context.Tasks.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
        if (task == null)
            return NotFound();

        task.IsCompleted = !task.IsCompleted;
        task.UpdatedAt = DateTime.UtcNow;
        task.CompletedAt = task.IsCompleted ? DateTime.UtcNow : null;

        await _context.SaveChangesAsync();
        return Ok(task);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = GetUserId();
        var task = await _context.Tasks.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
        if (task == null)
            return NotFound();

        _context.Tasks.Remove(task);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
