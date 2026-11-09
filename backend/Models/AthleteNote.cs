
namespace backend.Models;

public class AthleteNote
{
    public int AthleteNoteId { get; set; }
    public int AthleteId { get; set; }
    public int AuthorUserId { get; set; }
    public int? TrainingId { get; set; }

    public NoteType Type { get; set; }
    public string Text { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EditedAt { get; set; }

    public User Athlete { get; set; } = null!;
    public User Author { get; set; } = null!;
    public Training? Training { get; set; }
}
