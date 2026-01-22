namespace TaskAPI.DTOs;

public class SyncTasksDto
{
    public List<CreateTaskDto> Tasks { get; set; } = new();
}
