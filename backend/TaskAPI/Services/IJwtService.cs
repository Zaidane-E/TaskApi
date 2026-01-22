using TaskAPI.Models;

namespace TaskAPI.Services;

public interface IJwtService
{
    string GenerateToken(User user);
}
