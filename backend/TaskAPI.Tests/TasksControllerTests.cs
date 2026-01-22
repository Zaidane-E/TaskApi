using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskAPI.Controllers;
using TaskAPI.Models;

namespace TaskAPI.Tests;

public class TasksControllerTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static TasksController CreateControllerWithUser(AppDbContext context, int userId)
    {
        var controller = new TasksController(context);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Email, $"user{userId}@test.com")
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };
        return controller;
    }

    private static async Task<User> CreateTestUser(AppDbContext context, int id = 1)
    {
        var user = new User
        {
            Id = id,
            Email = $"user{id}@test.com",
            PasswordHash = "hashed",
            CreatedAt = DateTime.UtcNow
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();
        return user;
    }

    #region GET Tests

    [Fact]
    public async Task Get_ReturnsEmptyList_WhenNoTasks()
    {
        using var context = CreateContext();
        var user = await CreateTestUser(context);
        var controller = CreateControllerWithUser(context, user.Id);

        var result = await controller.Get();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var tasks = Assert.IsAssignableFrom<IEnumerable<TaskItem>>(okResult.Value);
        Assert.Empty(tasks);
    }

    [Fact]
    public async Task Get_ReturnsOnlyUserTasks()
    {
        using var context = CreateContext();
        var user1 = await CreateTestUser(context, 1);
        var user2 = await CreateTestUser(context, 2);

        context.Tasks.AddRange(
            new TaskItem { Title = "User1 Task", UserId = user1.Id, CreatedAt = DateTime.UtcNow },
            new TaskItem { Title = "User2 Task", UserId = user2.Id, CreatedAt = DateTime.UtcNow }
        );
        await context.SaveChangesAsync();

        var controller = CreateControllerWithUser(context, user1.Id);

        var result = await controller.Get();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var tasks = Assert.IsAssignableFrom<IEnumerable<TaskItem>>(okResult.Value).ToList();
        Assert.Single(tasks);
        Assert.Equal("User1 Task", tasks[0].Title);
    }

    [Fact]
    public async Task Get_FiltersBy_IsCompleted()
    {
        using var context = CreateContext();
        var user = await CreateTestUser(context);
        context.Tasks.AddRange(
            new TaskItem { Title = "Completed Task", IsCompleted = true, UserId = user.Id, CreatedAt = DateTime.UtcNow },
            new TaskItem { Title = "Pending Task", IsCompleted = false, UserId = user.Id, CreatedAt = DateTime.UtcNow }
        );
        await context.SaveChangesAsync();

        var controller = CreateControllerWithUser(context, user.Id);

        var result = await controller.Get(isCompleted: true);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var tasks = Assert.IsAssignableFrom<IEnumerable<TaskItem>>(okResult.Value).ToList();
        Assert.Single(tasks);
        Assert.Equal("Completed Task", tasks[0].Title);
    }

    [Fact]
    public async Task Get_FiltersBy_Priority()
    {
        using var context = CreateContext();
        var user = await CreateTestUser(context);
        context.Tasks.AddRange(
            new TaskItem { Title = "High Priority", Priority = Priority.High, UserId = user.Id, CreatedAt = DateTime.UtcNow },
            new TaskItem { Title = "Low Priority", Priority = Priority.Low, UserId = user.Id, CreatedAt = DateTime.UtcNow }
        );
        await context.SaveChangesAsync();

        var controller = CreateControllerWithUser(context, user.Id);

        var result = await controller.Get(priority: Priority.High);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var tasks = Assert.IsAssignableFrom<IEnumerable<TaskItem>>(okResult.Value).ToList();
        Assert.Single(tasks);
        Assert.Equal("High Priority", tasks[0].Title);
    }

    [Fact]
    public async Task Get_SortsBy_Priority()
    {
        using var context = CreateContext();
        var user = await CreateTestUser(context);
        context.Tasks.AddRange(
            new TaskItem { Title = "Low", Priority = Priority.Low, UserId = user.Id, CreatedAt = DateTime.UtcNow },
            new TaskItem { Title = "High", Priority = Priority.High, UserId = user.Id, CreatedAt = DateTime.UtcNow },
            new TaskItem { Title = "Medium", Priority = Priority.Medium, UserId = user.Id, CreatedAt = DateTime.UtcNow }
        );
        await context.SaveChangesAsync();

        var controller = CreateControllerWithUser(context, user.Id);

        var result = await controller.Get(sortBy: "priority", sortOrder: "asc");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var tasks = Assert.IsAssignableFrom<IEnumerable<TaskItem>>(okResult.Value).ToList();
        Assert.Equal(3, tasks.Count);
        Assert.Equal(Priority.Low, tasks[0].Priority);
        Assert.Equal(Priority.Medium, tasks[1].Priority);
        Assert.Equal(Priority.High, tasks[2].Priority);
    }

    [Fact]
    public async Task Get_SortsBy_DueDate()
    {
        using var context = CreateContext();
        var user = await CreateTestUser(context);
        var now = DateTime.UtcNow;
        context.Tasks.AddRange(
            new TaskItem { Title = "Later", DueDate = now.AddDays(10), UserId = user.Id, CreatedAt = now },
            new TaskItem { Title = "Soon", DueDate = now.AddDays(1), UserId = user.Id, CreatedAt = now },
            new TaskItem { Title = "Middle", DueDate = now.AddDays(5), UserId = user.Id, CreatedAt = now }
        );
        await context.SaveChangesAsync();

        var controller = CreateControllerWithUser(context, user.Id);

        var result = await controller.Get(sortBy: "dueDate", sortOrder: "asc");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var tasks = Assert.IsAssignableFrom<IEnumerable<TaskItem>>(okResult.Value).ToList();
        Assert.Equal(3, tasks.Count);
        Assert.Equal("Soon", tasks[0].Title);
        Assert.Equal("Middle", tasks[1].Title);
        Assert.Equal("Later", tasks[2].Title);
    }

    [Fact]
    public async Task Get_SortsBy_CreatedAt_Ascending()
    {
        using var context = CreateContext();
        var user = await CreateTestUser(context);
        context.Tasks.AddRange(
            new TaskItem { Title = "Third", UserId = user.Id, CreatedAt = DateTime.UtcNow.AddHours(2) },
            new TaskItem { Title = "First", UserId = user.Id, CreatedAt = DateTime.UtcNow },
            new TaskItem { Title = "Second", UserId = user.Id, CreatedAt = DateTime.UtcNow.AddHours(1) }
        );
        await context.SaveChangesAsync();

        var controller = CreateControllerWithUser(context, user.Id);

        var result = await controller.Get(sortBy: "createdAt", sortOrder: "asc");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var tasks = Assert.IsAssignableFrom<IEnumerable<TaskItem>>(okResult.Value).ToList();
        Assert.Equal(3, tasks.Count);
        Assert.Equal("First", tasks[0].Title);
        Assert.Equal("Second", tasks[1].Title);
        Assert.Equal("Third", tasks[2].Title);
    }

    [Fact]
    public async Task Get_CombinesFilters_IsCompletedAndPriority()
    {
        using var context = CreateContext();
        var user = await CreateTestUser(context);
        context.Tasks.AddRange(
            new TaskItem { Title = "High Completed", Priority = Priority.High, IsCompleted = true, UserId = user.Id, CreatedAt = DateTime.UtcNow },
            new TaskItem { Title = "High Pending", Priority = Priority.High, IsCompleted = false, UserId = user.Id, CreatedAt = DateTime.UtcNow },
            new TaskItem { Title = "Low Completed", Priority = Priority.Low, IsCompleted = true, UserId = user.Id, CreatedAt = DateTime.UtcNow },
            new TaskItem { Title = "Low Pending", Priority = Priority.Low, IsCompleted = false, UserId = user.Id, CreatedAt = DateTime.UtcNow }
        );
        await context.SaveChangesAsync();

        var controller = CreateControllerWithUser(context, user.Id);

        var result = await controller.Get(isCompleted: true, priority: Priority.High);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var tasks = Assert.IsAssignableFrom<IEnumerable<TaskItem>>(okResult.Value).ToList();
        Assert.Single(tasks);
        Assert.Equal("High Completed", tasks[0].Title);
    }

    [Fact]
    public async Task GetById_ReturnsTask_WhenTaskExists()
    {
        using var context = CreateContext();
        var user = await CreateTestUser(context);
        var task = new TaskItem { Title = "Test Task", UserId = user.Id };
        context.Tasks.Add(task);
        await context.SaveChangesAsync();

        var controller = CreateControllerWithUser(context, user.Id);

        var result = await controller.GetById(task.Id);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var returnedTask = Assert.IsType<TaskItem>(okResult.Value);
        Assert.Equal("Test Task", returnedTask.Title);
    }

    [Fact]
    public async Task GetById_ReturnsNotFound_WhenTaskBelongsToOtherUser()
    {
        using var context = CreateContext();
        var user1 = await CreateTestUser(context, 1);
        var user2 = await CreateTestUser(context, 2);
        var task = new TaskItem { Title = "User2's Task", UserId = user2.Id };
        context.Tasks.Add(task);
        await context.SaveChangesAsync();

        var controller = CreateControllerWithUser(context, user1.Id);

        var result = await controller.GetById(task.Id);

        Assert.IsType<NotFoundResult>(result);
    }

    #endregion

    #region POST Tests

    [Fact]
    public async Task Create_AddsTaskForCurrentUser()
    {
        using var context = CreateContext();
        var user = await CreateTestUser(context);
        var controller = CreateControllerWithUser(context, user.Id);
        var dto = new CreateTaskDto { Title = "New Task" };

        var result = await controller.Create(dto);

        var createdResult = Assert.IsType<CreatedAtActionResult>(result);
        var task = Assert.IsType<TaskItem>(createdResult.Value);
        Assert.Equal("New Task", task.Title);
        Assert.Equal(user.Id, task.UserId);
        Assert.False(task.IsCompleted);
        Assert.Equal(Priority.Medium, task.Priority);
    }

    [Fact]
    public async Task Create_AddsTaskWithPriorityAndDueDate()
    {
        using var context = CreateContext();
        var user = await CreateTestUser(context);
        var controller = CreateControllerWithUser(context, user.Id);
        var dueDate = DateTime.UtcNow.AddDays(7);
        var dto = new CreateTaskDto
        {
            Title = "High Priority Task",
            Priority = Priority.High,
            DueDate = dueDate
        };

        var result = await controller.Create(dto);

        var createdResult = Assert.IsType<CreatedAtActionResult>(result);
        var task = Assert.IsType<TaskItem>(createdResult.Value);
        Assert.Equal("High Priority Task", task.Title);
        Assert.Equal(Priority.High, task.Priority);
        Assert.NotNull(task.DueDate);
    }

    #endregion

    #region Toggle Tests

    [Fact]
    public async Task ToggleComplete_SetsCompletedAt_WhenCompletingTask()
    {
        using var context = CreateContext();
        var user = await CreateTestUser(context);
        var task = new TaskItem { Title = "Task", IsCompleted = false, UserId = user.Id };
        context.Tasks.Add(task);
        await context.SaveChangesAsync();

        var controller = CreateControllerWithUser(context, user.Id);

        var result = await controller.ToggleComplete(task.Id);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var toggledTask = Assert.IsType<TaskItem>(okResult.Value);
        Assert.True(toggledTask.IsCompleted);
        Assert.NotNull(toggledTask.CompletedAt);
    }

    [Fact]
    public async Task ToggleComplete_ClearsCompletedAt_WhenUncompletingTask()
    {
        using var context = CreateContext();
        var user = await CreateTestUser(context);
        var task = new TaskItem { Title = "Task", IsCompleted = true, CompletedAt = DateTime.UtcNow, UserId = user.Id };
        context.Tasks.Add(task);
        await context.SaveChangesAsync();

        var controller = CreateControllerWithUser(context, user.Id);

        var result = await controller.ToggleComplete(task.Id);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var toggledTask = Assert.IsType<TaskItem>(okResult.Value);
        Assert.False(toggledTask.IsCompleted);
        Assert.Null(toggledTask.CompletedAt);
    }

    [Fact]
    public async Task ToggleComplete_ReturnsNotFound_WhenTaskBelongsToOtherUser()
    {
        using var context = CreateContext();
        var user1 = await CreateTestUser(context, 1);
        var user2 = await CreateTestUser(context, 2);
        var task = new TaskItem { Title = "Task", UserId = user2.Id };
        context.Tasks.Add(task);
        await context.SaveChangesAsync();

        var controller = CreateControllerWithUser(context, user1.Id);

        var result = await controller.ToggleComplete(task.Id);

        Assert.IsType<NotFoundResult>(result);
    }

    #endregion

    #region PUT Tests

    [Fact]
    public async Task Update_ModifiesAllFields()
    {
        using var context = CreateContext();
        var user = await CreateTestUser(context);
        var task = new TaskItem
        {
            Title = "Original",
            IsCompleted = false,
            Priority = Priority.Low,
            DueDate = null,
            UserId = user.Id
        };
        context.Tasks.Add(task);
        await context.SaveChangesAsync();

        var controller = CreateControllerWithUser(context, user.Id);
        var dueDate = DateTime.UtcNow.AddDays(3);
        var dto = new UpdateTaskDto
        {
            Title = "Updated",
            IsCompleted = true,
            Priority = Priority.High,
            DueDate = dueDate
        };

        var result = await controller.Update(task.Id, dto);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var updatedTask = Assert.IsType<TaskItem>(okResult.Value);
        Assert.Equal("Updated", updatedTask.Title);
        Assert.True(updatedTask.IsCompleted);
        Assert.NotNull(updatedTask.CompletedAt);
        Assert.Equal(Priority.High, updatedTask.Priority);
    }

    [Fact]
    public async Task Update_ReturnsNotFound_WhenTaskBelongsToOtherUser()
    {
        using var context = CreateContext();
        var user1 = await CreateTestUser(context, 1);
        var user2 = await CreateTestUser(context, 2);
        var task = new TaskItem { Title = "Task", UserId = user2.Id };
        context.Tasks.Add(task);
        await context.SaveChangesAsync();

        var controller = CreateControllerWithUser(context, user1.Id);
        var dto = new UpdateTaskDto { Title = "Updated", IsCompleted = false };

        var result = await controller.Update(task.Id, dto);

        Assert.IsType<NotFoundResult>(result);
    }

    #endregion

    #region DELETE Tests

    [Fact]
    public async Task Delete_RemovesTask_WhenTaskExists()
    {
        using var context = CreateContext();
        var user = await CreateTestUser(context);
        var task = new TaskItem { Title = "Task to Delete", UserId = user.Id };
        context.Tasks.Add(task);
        await context.SaveChangesAsync();

        var controller = CreateControllerWithUser(context, user.Id);

        var result = await controller.Delete(task.Id);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(context.Tasks);
    }

    [Fact]
    public async Task Delete_ReturnsNotFound_WhenTaskBelongsToOtherUser()
    {
        using var context = CreateContext();
        var user1 = await CreateTestUser(context, 1);
        var user2 = await CreateTestUser(context, 2);
        var task = new TaskItem { Title = "Task", UserId = user2.Id };
        context.Tasks.Add(task);
        await context.SaveChangesAsync();

        var controller = CreateControllerWithUser(context, user1.Id);

        var result = await controller.Delete(task.Id);

        Assert.IsType<NotFoundResult>(result);
        Assert.Single(context.Tasks);
    }

    #endregion
}
