
using backend.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace backend.Data;

public static class DevelopmentDataSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var provider = scope.ServiceProvider;

        var db = provider.GetRequiredService<ApplicationDbContext>();
        var users = provider.GetRequiredService<UserManager<User>>();

        var coach = await users.FindByEmailAsync("coach.test@example.com");

        if (coach is null)
            throw new InvalidOperationException(
                "Development coach was not found. Seed the coach first.");

        var athletes = new List<User>();

        var athleteData = new[]
        {
            ("athlete1.test@example.com", "Иван", "Петров", Gender.Male, WeightClass.Lightweight),
            ("athlete2.test@example.com", "Алексей", "Сидоров", Gender.Male, WeightClass.Welterweight),
            ("athlete3.test@example.com", "Мария", "Иванова", Gender.Female, WeightClass.Lightweight),
            ("athlete4.test@example.com", "Дмитрий", "Смирнов", Gender.Male, WeightClass.Middleweight),
            ("athlete5.test@example.com", "Анна", "Кузнецова", Gender.Female, WeightClass.Welterweight)
        };

        foreach (var item in athleteData)
        {
            var (email, name, surname, gender, weightClass) = item;
            var athlete = await users.FindByEmailAsync(email);

            if (athlete is null)
            {
                athlete = new User
                {
                    UserName = email,
                    Email = email,
                    Name = name,
                    Surname = surname,
                    EmailConfirmed = true
                };

                var result = await users.CreateAsync(athlete, "AthletePass123!");

                if (!result.Succeeded)
                    throw new InvalidOperationException(
                        string.Join("; ", result.Errors.Select(e => e.Description)));
            }

            if (!await users.IsInRoleAsync(athlete, "Athlete"))
            {
                var roleResult = await users.AddToRoleAsync(athlete, "Athlete");

                if (!roleResult.Succeeded)
                    throw new InvalidOperationException(
                        string.Join("; ", roleResult.Errors.Select(e => e.Description)));
            }

            if (!await db.AthleteProfiles.AnyAsync(p => p.UserId == athlete.Id))
            {
                db.AthleteProfiles.Add(new AthleteProfile
                {
                    UserId = athlete.Id,
                    Gender = gender,
                    WeightCategory = weightClass,
                    BeltColor = "Белый"
                });
            }

            athletes.Add(athlete);
        }

        await db.SaveChangesAsync();

        var groupNames = new[]
        {
            "Юниоры 14–16",
            "Начинающие",
            "Продвинутая группа"
        };

        var groups = new List<TrainingGroup>();

        foreach (var name in groupNames)
        {
            var group = await db.TrainingGroups.FirstOrDefaultAsync(g =>
                g.CoachId == coach.Id && g.Name == name);

            if (group is null)
            {
                group = new TrainingGroup
                {
                    Name = name,
                    Description = $"Тестовая группа: {name}",
                    CoachId = coach.Id
                };

                db.TrainingGroups.Add(group);
                await db.SaveChangesAsync();
            }

            groups.Add(group);
        }

        for (var i = 0; i < athletes.Count; i++)
        {
            var group = groups[i % groups.Count];
            var athlete = athletes[i];

            var membershipExists = await db.GroupMemberships.AnyAsync(m =>
                m.TrainingGroupId == group.TrainingGroupId &&
                m.AthleteId == athlete.Id &&
                m.LeftDate == null);

            if (!membershipExists)
            {
                db.GroupMemberships.Add(new GroupMembership
                {
                    TrainingGroupId = group.TrainingGroupId,
                    AthleteId = athlete.Id,
                    JoinedDate = DateTime.UtcNow.Date
                });
            }
        }

        await db.SaveChangesAsync();

        var today = DateTime.UtcNow.Date;

        var trainingData = new[]
        {
            (today, new TimeOnly(18, 30), new TimeOnly(20, 0), TrainingType.Technique, TrainingStatus.Planned, 0),
            (today, new TimeOnly(20, 15), new TimeOnly(21, 15), TrainingType.Cardio, TrainingStatus.Planned, 0),
            (today.AddDays(-1), new TimeOnly(18, 30), new TimeOnly(20, 0), TrainingType.Sparring, TrainingStatus.Completed, 0),
            (today.AddDays(1), new TimeOnly(17, 0), new TimeOnly(18, 30), TrainingType.Strength, TrainingStatus.Planned, 1),
            (today.AddDays(2), new TimeOnly(19, 0), new TimeOnly(20, 30), TrainingType.Mixed, TrainingStatus.Planned, 2)
        };

        foreach (var item in trainingData)
        {
            var (date, start, end, type, status, groupIndex) = item;
            var group = groups[groupIndex];

            var trainingExists = await db.Trainings.AnyAsync(t =>
                t.CoachId == coach.Id &&
                t.TrainingGroupId == group.TrainingGroupId &&
                t.Date == date &&
                t.StartTime == start &&
                t.Type == type);

            if (trainingExists)
                continue;

            var training = new Training
            {
                CoachId = coach.Id,
                TrainingGroupId = group.TrainingGroupId,
                Date = date,
                StartTime = start,
                EndTime = end,
                Type = type,
                Status = status,
                Description = $"Тестовая тренировка: {type}",
                CreationTime = DateTime.UtcNow
            };

            db.Trainings.Add(training);
            await db.SaveChangesAsync();

            var groupAthletes = await db.GroupMemberships
                .Where(m =>
                    m.TrainingGroupId == group.TrainingGroupId &&
                    m.LeftDate == null)
                .Select(m => m.AthleteId)
                .ToListAsync();

            foreach (var athleteId in groupAthletes)
            {
                db.TrainingParticipants.Add(new TrainingParticipant
                {
                    TrainingId = training.TrainingId,
                    AthleteId = athleteId,
                    Status = status == TrainingStatus.Completed
                        ? AttendanceStatus.Present
                        : AttendanceStatus.Unmarked
                });
            }

            await db.SaveChangesAsync();
        }

        foreach (var athlete in athletes)
        {
            var measurementExists = await db.PhysicalMeasurements.AnyAsync(m =>
                m.AthleteId == athlete.Id &&
                m.RecordedByUserId == coach.Id &&
                m.Type == MeasurementType.Weight);

            if (!measurementExists)
            {
                db.PhysicalMeasurements.Add(new PhysicalMeasurement
                {
                    AthleteId = athlete.Id,
                    RecordedByUserId = coach.Id,
                    Type = MeasurementType.Weight,
                    Value = 55 + athlete.Id % 20,
                    MeasuredAt = DateTime.UtcNow,
                    Note = "Тестовый показатель"
                });
            }

            var noteExists = await db.AthleteNotes.AnyAsync(n =>
                n.AthleteId == athlete.Id &&
                n.AuthorUserId == coach.Id &&
                n.Text == "Тестовая заметка тренера");

            if (!noteExists)
            {
                db.AthleteNotes.Add(new AthleteNote
                {
                    AthleteId = athlete.Id,
                    AuthorUserId = coach.Id,
                    Type = NoteType.Coach,
                    Text = "Тестовая заметка тренера",
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        await db.SaveChangesAsync();
    }
}
