
using Microsoft.AspNetCore.Identity;

namespace backend.Models;

public class User : IdentityUser<int>
{
    public string Name { get; set; } = string.Empty;
    public string Surname { get; set; } = string.Empty;

    // Архивирование учётной записи
    public bool IsArchived { get; set; } = false;

    // Необязательная привязка аккаунта к профилю спортсмена
    public AthleteProfile? AthleteProfile { get; set; }

    // Родительские связи: этот пользователь является родителем
    public ICollection<ParentAthlete> Children { get; set; }
        = new List<ParentAthlete>();

    // Группы, которые ведёт тренер
    public ICollection<Training> CoachedTrainings { get; set; }
        = new List<Training>();

    // Замеры, которые записал этот пользователь
    public ICollection<PhysicalMeasurement> RecordedMeasurements { get; set; }
        = new List<PhysicalMeasurement>();

    // Заметки, которые написал этот пользователь
    public ICollection<AthleteNote> WrittenNotes { get; set; }
        = new List<AthleteNote>();
    public ICollection<AthleteProfile> CreatedAthleteProfiles { get; set; }
        = new List<AthleteProfile>();
}
