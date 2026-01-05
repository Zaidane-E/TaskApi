using System.ComponentModel.DataAnnotations;

public class CreateTaskDto
{
    [Required(ErrorMessage = "Title is required")]
    [StringLength(200, MinimumLength = 1, ErrorMessage = "Title must be between 1 and 200 characters")]
    public string Title { get; set; } = string.Empty;

    public Priority Priority { get; set; } = Priority.Medium;

    public DateTime? DueDate { get; set; }
}