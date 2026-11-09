
using backend.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace backend.Data;

public class ApplicationDbContext
    : IdentityDbContext<User, IdentityRole<int>, int>
{
    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<AthleteProfile> AthleteProfiles => Set<AthleteProfile>();
    public DbSet<ParentAthlete> ParentAthletes => Set<ParentAthlete>();
    public DbSet<TrainingGroup> TrainingGroups => Set<TrainingGroup>();
    public DbSet<GroupMembership> GroupMemberships => Set<GroupMembership>();
    public DbSet<Training> Trainings => Set<Training>();
    public DbSet<TrainingParticipant> TrainingParticipants => Set<TrainingParticipant>();
    public DbSet<PhysicalMeasurement> PhysicalMeasurements => Set<PhysicalMeasurement>();
    public DbSet<AthleteNote> AthleteNotes => Set<AthleteNote>();
    public DbSet<GroupMetric> GroupMetrics => Set<GroupMetric>();

    // Настройки регистрации тренеров.
    public DbSet<CoachRegistrationSettings> CoachRegistrationSettings
        => Set<CoachRegistrationSettings>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // ==============================
        // USER
        // ==============================

        builder.Entity<User>()
            .Property(x => x.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Entity<User>()
            .Property(x => x.Surname)
            .HasMaxLength(100)
            .IsRequired();


        // ==============================
        // ATHLETE PROFILE
        // ==============================

        builder.Entity<AthleteProfile>()
            .HasKey(x => x.UserId);

        builder.Entity<AthleteProfile>()
            .HasOne(x => x.User)
            .WithOne(x => x.AthleteProfile)
            .HasForeignKey<AthleteProfile>(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);


        // ==============================
        // PARENT - ATHLETE
        // ==============================

        builder.Entity<ParentAthlete>()
            .HasKey(x => new { x.ParentId, x.AthleteId });

        builder.Entity<ParentAthlete>()
            .HasOne(x => x.Parent)
            .WithMany(x => x.Children)
            .HasForeignKey(x => x.ParentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<ParentAthlete>()
            .HasOne(x => x.Athlete)
            .WithMany(x => x.Parents)
            .HasForeignKey(x => x.AthleteId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<ParentAthlete>()
            .ToTable(t => t.HasCheckConstraint(
                "CK_ParentAthlete_NotSelf",
                "\"ParentId\" <> \"AthleteId\""));


        // ==============================
        // TRAINING GROUP
        // ==============================

        builder.Entity<TrainingGroup>()
            .Property(x => x.Name)
            .HasMaxLength(150)
            .IsRequired();

        builder.Entity<TrainingGroup>()
            .HasOne(x => x.Coach)
            .WithMany()
            .HasForeignKey(x => x.CoachId)
            .OnDelete(DeleteBehavior.Restrict);


        // ==============================
        // GROUP METRICS
        // ==============================

        builder.Entity<GroupMetric>()
            .Property(x => x.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Entity<GroupMetric>()
            .Property(x => x.Unit)
            .HasMaxLength(30)
            .IsRequired();

        builder.Entity<GroupMetric>()
            .HasOne(x => x.TrainingGroup)
            .WithMany(x => x.Metrics)
            .HasForeignKey(x => x.TrainingGroupId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<GroupMetric>()
            .HasIndex(x => new
            {
                x.TrainingGroupId,
                x.Name
            })
            .IsUnique();


        // ==============================
        // GROUP MEMBERSHIP
        // ==============================

        builder.Entity<GroupMembership>()
            .HasOne(x => x.TrainingGroup)
            .WithMany(x => x.Memberships)
            .HasForeignKey(x => x.TrainingGroupId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<GroupMembership>()
            .HasOne(x => x.Athlete)
            .WithMany(x => x.GroupMemberships)
            .HasForeignKey(x => x.AthleteId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<GroupMembership>()
            .HasIndex(x => new
            {
                x.TrainingGroupId,
                x.AthleteId
            })
            .IsUnique()
            .HasFilter("\"LeftDate\" IS NULL");

        builder.Entity<GroupMembership>()
            .ToTable(t => t.HasCheckConstraint(
                "CK_GroupMembership_Dates",
                "\"LeftDate\" IS NULL OR \"LeftDate\" >= \"JoinedDate\""));


        // ==============================
        // TRAINING
        // ==============================

        builder.Entity<Training>()
            .HasOne(x => x.Coach)
            .WithMany(x => x.CoachedTrainings)
            .HasForeignKey(x => x.CoachId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<Training>()
            .HasOne(x => x.TrainingGroup)
            .WithMany(x => x.Trainings)
            .HasForeignKey(x => x.TrainingGroupId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Entity<Training>()
            .HasIndex(x => new
            {
                x.TrainingGroupId,
                x.Date
            });


        // ==============================
        // TRAINING PARTICIPANTS
        // ==============================

        builder.Entity<TrainingParticipant>()
            .HasOne(x => x.Training)
            .WithMany(x => x.Participants)
            .HasForeignKey(x => x.TrainingId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<TrainingParticipant>()
            .HasOne(x => x.Athlete)
            .WithMany(x => x.TrainingParticipations)
            .HasForeignKey(x => x.AthleteId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<TrainingParticipant>()
            .HasIndex(x => new
            {
                x.TrainingId,
                x.AthleteId
            })
            .IsUnique();


        // ==============================
        // PHYSICAL MEASUREMENTS
        // ==============================

        builder.Entity<PhysicalMeasurement>()
            .Property(x => x.Value)
            .HasPrecision(8, 2);

        builder.Entity<PhysicalMeasurement>()
            .HasOne(x => x.Athlete)
            .WithMany(x => x.Measurements)
            .HasForeignKey(x => x.AthleteId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<PhysicalMeasurement>()
            .HasOne(x => x.RecordedByUser)
            .WithMany(x => x.RecordedMeasurements)
            .HasForeignKey(x => x.RecordedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<PhysicalMeasurement>()
            .HasOne(x => x.GroupMetric)
            .WithMany(x => x.Measurements)
            .HasForeignKey(x => x.GroupMetricId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<PhysicalMeasurement>()
            .HasIndex(x => new
            {
                x.AthleteId,
                x.Type,
                x.MeasuredAt
            });

        builder.Entity<PhysicalMeasurement>()
            .HasIndex(x => new
            {
                x.AthleteId,
                x.GroupMetricId,
                x.MeasuredAt
            });


        // ==============================
        // ATHLETE NOTES
        // ==============================

        builder.Entity<AthleteNote>()
            .Property(x => x.Text)
            .HasMaxLength(5000)
            .IsRequired();

        builder.Entity<AthleteNote>()
            .HasOne(x => x.Athlete)
            .WithMany(x => x.AthleteNotes)
            .HasForeignKey(x => x.AthleteId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<AthleteNote>()
            .HasOne(x => x.Author)
            .WithMany(x => x.WrittenNotes)
            .HasForeignKey(x => x.AuthorUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<AthleteNote>()
            .HasOne(x => x.Training)
            .WithMany(x => x.Notes)
            .HasForeignKey(x => x.TrainingId)
            .OnDelete(DeleteBehavior.SetNull);


        // ==============================
        // COACH REGISTRATION SETTINGS
        // ==============================

        builder.Entity<CoachRegistrationSettings>()
            .HasKey(x => x.Id);

        builder.Entity<CoachRegistrationSettings>()
            .Property(x => x.InvitationCodeHash)
            .HasMaxLength(500);

        builder.Entity<CoachRegistrationSettings>()
            .Property(x => x.UpdatedAtUtc)
            .IsRequired();

        builder.Entity<CoachRegistrationSettings>()
            .ToTable(t => t.HasCheckConstraint(
                "CK_CoachRegistrationSettings_Singleton",
                "\"Id\" = 1"));
    }
}
