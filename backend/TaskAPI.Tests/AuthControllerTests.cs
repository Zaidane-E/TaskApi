using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using TaskAPI.Controllers;
using TaskAPI.DTOs.Auth;
using TaskAPI.Models;
using TaskAPI.Services;

namespace TaskAPI.Tests;

public class AuthControllerTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static Mock<IJwtService> CreateMockJwtService()
    {
        var mock = new Mock<IJwtService>();
        mock.Setup(x => x.GenerateToken(It.IsAny<User>()))
            .Returns("test-jwt-token");
        return mock;
    }

    #region Register Tests

    [Fact]
    public async Task Register_CreatesNewUser_WhenEmailNotExists()
    {
        using var context = CreateContext();
        var jwtService = CreateMockJwtService();
        var controller = new AuthController(context, jwtService.Object);
        var dto = new RegisterDto { Email = "test@example.com", Password = "password123" };

        var result = await controller.Register(dto);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AuthResponseDto>(okResult.Value);
        Assert.Equal("test-jwt-token", response.Token);
        Assert.Equal("test@example.com", response.Email);
        Assert.Single(context.Users);
    }

    [Fact]
    public async Task Register_ReturnsBadRequest_WhenEmailAlreadyExists()
    {
        using var context = CreateContext();
        context.Users.Add(new User
        {
            Email = "existing@example.com",
            PasswordHash = "hash",
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var jwtService = CreateMockJwtService();
        var controller = new AuthController(context, jwtService.Object);
        var dto = new RegisterDto { Email = "existing@example.com", Password = "password123" };

        var result = await controller.Register(dto);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.NotNull(badRequest.Value);
    }

    [Fact]
    public async Task Register_HashesPassword()
    {
        using var context = CreateContext();
        var jwtService = CreateMockJwtService();
        var controller = new AuthController(context, jwtService.Object);
        var dto = new RegisterDto { Email = "test@example.com", Password = "password123" };

        await controller.Register(dto);

        var user = await context.Users.FirstAsync();
        Assert.NotEqual("password123", user.PasswordHash);
        Assert.True(BCrypt.Net.BCrypt.Verify("password123", user.PasswordHash));
    }

    #endregion

    #region Login Tests

    [Fact]
    public async Task Login_ReturnsToken_WhenCredentialsAreValid()
    {
        using var context = CreateContext();
        context.Users.Add(new User
        {
            Email = "test@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var jwtService = CreateMockJwtService();
        var controller = new AuthController(context, jwtService.Object);
        var dto = new LoginDto { Email = "test@example.com", Password = "password123" };

        var result = await controller.Login(dto);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AuthResponseDto>(okResult.Value);
        Assert.Equal("test-jwt-token", response.Token);
        Assert.Equal("test@example.com", response.Email);
    }

    [Fact]
    public async Task Login_ReturnsUnauthorized_WhenEmailNotFound()
    {
        using var context = CreateContext();
        var jwtService = CreateMockJwtService();
        var controller = new AuthController(context, jwtService.Object);
        var dto = new LoginDto { Email = "nonexistent@example.com", Password = "password123" };

        var result = await controller.Login(dto);

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task Login_ReturnsUnauthorized_WhenPasswordIsWrong()
    {
        using var context = CreateContext();
        context.Users.Add(new User
        {
            Email = "test@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("correctpassword"),
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var jwtService = CreateMockJwtService();
        var controller = new AuthController(context, jwtService.Object);
        var dto = new LoginDto { Email = "test@example.com", Password = "wrongpassword" };

        var result = await controller.Login(dto);

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    #endregion

    #region SyncGuestTasks Tests

    [Fact]
    public async Task SyncGuestTasks_CreatesTasksForUser()
    {
        using var context = CreateContext();
        var user = new User
        {
            Email = "test@example.com",
            PasswordHash = "hash",
            CreatedAt = DateTime.UtcNow
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var jwtService = CreateMockJwtService();
        var controller = new AuthController(context, jwtService.Object);
        SetupControllerWithUser(controller, user.Id);

        var dto = new TaskAPI.DTOs.SyncTasksDto
        {
            Tasks = new List<CreateTaskDto>
            {
                new() { Title = "Guest Task 1", Priority = Priority.High },
                new() { Title = "Guest Task 2", Priority = Priority.Low, DueDate = DateTime.UtcNow.AddDays(5) }
            }
        };

        var result = await controller.SyncGuestTasks(dto);

        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(2, context.Tasks.Count());
        Assert.All(context.Tasks, t => Assert.Equal(user.Id, t.UserId));
    }

    [Fact]
    public async Task SyncGuestTasks_ReturnsCorrectCount()
    {
        using var context = CreateContext();
        var user = new User
        {
            Email = "test@example.com",
            PasswordHash = "hash",
            CreatedAt = DateTime.UtcNow
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var jwtService = CreateMockJwtService();
        var controller = new AuthController(context, jwtService.Object);
        SetupControllerWithUser(controller, user.Id);

        var dto = new TaskAPI.DTOs.SyncTasksDto
        {
            Tasks = new List<CreateTaskDto>
            {
                new() { Title = "Task 1" },
                new() { Title = "Task 2" },
                new() { Title = "Task 3" }
            }
        };

        var result = await controller.SyncGuestTasks(dto);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = okResult.Value;
        var countProperty = response?.GetType().GetProperty("count");
        Assert.NotNull(countProperty);
        Assert.Equal(3, (int)countProperty.GetValue(response)!);
    }

    private static void SetupControllerWithUser(AuthController controller, int userId)
    {
        var claims = new List<System.Security.Claims.Claim>
        {
            new(System.Security.Claims.ClaimTypes.NameIdentifier, userId.ToString()),
            new(System.Security.Claims.ClaimTypes.Email, $"user{userId}@test.com")
        };
        var identity = new System.Security.Claims.ClaimsIdentity(claims, "TestAuth");
        var principal = new System.Security.Claims.ClaimsPrincipal(identity);
        controller.ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext
        {
            HttpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext { User = principal }
        };
    }

    #endregion
}
