namespace backend.Models;

public class CoachRegistrationSettings
{
    public int Id { get; set; } = 1;

    // Хеш действующего кода приглашения.
    // Сам код в базе данных не хранится.
    public string? InvitationCodeHash { get; set; }

    // Разрешена ли регистрация новых тренеров.
    public bool IsRegistrationEnabled { get; set; } = false;

    // Дата последнего изменения настроек.
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}