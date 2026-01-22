using System.ComponentModel.DataAnnotations.Schema;
using TaskAPI.Models;

public class TaskItem
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public bool IsCompleted { get; set; }
    public Priority Priority { get; set; } = Priority.Medium;
    public DateTime? DueDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    [NotMapped]
    public bool IsOverdue => DueDate.HasValue && DueDate.Value.Date < DateTime.UtcNow.Date && !IsCompleted;
}
