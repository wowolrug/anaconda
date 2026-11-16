
namespace backend.Models;

public class AthleteProfile
{
    public int AthleteProfileId { get; set; }

    // Необязательная привязка к аккаунту спортсмена.
    public int? UserId { get; set; }

    // Кто создал профиль. NULL допускается для старых профилей.
    public int? CreatedByUserId { get; set; }

    public string Name { get; set; } = string.Empty;
    public string Surname { get; set; } = string.Empty;

    public Gender Gender { get; set; }
    public string? BeltColor { get; set; }

    public WeightClass WeightCategory { get; set; }
        = WeightClass.Unspecified;

    public bool IsArchived { get; set; } = false;

    public User? User { get; set; }
    public User? CreatedBy { get; set; }

    public ICollection<GroupMembership> GroupMemberships { get; set; }
        = new List<GroupMembership>();

    public ICollection<TrainingParticipant> TrainingParticipations { get; set; }
        = new List<TrainingParticipant>();

    public ICollection<PhysicalMeasurement> Measurements { get; set; }
        = new List<PhysicalMeasurement>();

    public ICollection<AthleteNote> Notes { get; set; }
        = new List<AthleteNote>();

    public ICollection<ParentAthlete> Parents { get; set; }
        = new List<ParentAthlete>();
}
