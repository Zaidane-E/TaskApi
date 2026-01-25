using Microsoft.EntityFrameworkCore;
using TaskAPI.Models;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<TaskItem> Tasks => Set<TaskItem>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Habit> Habits => Set<Habit>();
    public DbSet<HabitCompletion> HabitCompletions => Set<HabitCompletion>();
    public DbSet<AccountabilitySettings> AccountabilitySettings => Set<AccountabilitySettings>();
    public DbSet<Penalty> Penalties => Set<Penalty>();
    public DbSet<Reward> Rewards => Set<Reward>();
    public DbSet<AccountabilityLog> AccountabilityLogs => Set<AccountabilityLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<TaskItem>()
            .HasOne(t => t.User)
            .WithMany(u => u.Tasks)
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Habit>()
            .HasOne(h => h.User)
            .WithMany(u => u.Habits)
            .HasForeignKey(h => h.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<HabitCompletion>()
            .HasOne(hc => hc.Habit)
            .WithMany(h => h.Completions)
            .HasForeignKey(hc => hc.HabitId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<HabitCompletion>()
            .HasIndex(hc => new { hc.HabitId, hc.CompletedDate })
            .IsUnique();

        modelBuilder.Entity<HabitCompletion>()
            .HasIndex(hc => new { hc.HabitId, hc.Year, hc.Month });

        modelBuilder.Entity<HabitCompletion>()
            .HasIndex(hc => new { hc.HabitId, hc.Year, hc.Week });

        // Accountability
        modelBuilder.Entity<AccountabilitySettings>()
            .HasOne(a => a.User)
            .WithOne()
            .HasForeignKey<AccountabilitySettings>(a => a.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Penalty>()
            .HasOne(p => p.AccountabilitySettings)
            .WithMany(a => a.Penalties)
            .HasForeignKey(p => p.AccountabilitySettingsId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Reward>()
            .HasOne(r => r.AccountabilitySettings)
            .WithMany(a => a.Rewards)
            .HasForeignKey(r => r.AccountabilitySettingsId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<AccountabilityLog>()
            .HasOne(l => l.User)
            .WithMany()
            .HasForeignKey(l => l.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<AccountabilityLog>()
            .HasIndex(l => new { l.UserId, l.Date })
            .IsUnique();
    }
}
