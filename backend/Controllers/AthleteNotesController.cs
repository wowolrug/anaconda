using System.Security.Claims;
using backend.Data;
using backend.DTOs;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AthleteNotesController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public AthleteNotesController(ApplicationDbContext db)
    {
        _db = db;
    }

    private int? GetCurrentUserId()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        return int.TryParse(userId, out var id) ? id : null;
    }

    private NoteType? GetCurrentNoteType()
    {
        if (User.IsInRole("Coach"))
            return NoteType.Coach;

        if (User.IsInRole("Athlete"))
            return NoteType.Athlete;

        if (User.IsInRole("Parent"))
            return NoteType.Parent;

        return null;
    }

    private async Task<bool> CanAccessAthleteAsync(int athleteId)
    {
        var userId = GetCurrentUserId();

        if (userId is null)
            return false;

        if (User.IsInRole("Coach"))
        {
            return await _db.GroupMemberships.AnyAsync(m =>
                m.AthleteId == athleteId &&
                m.LeftDate == null &&
                _db.TrainingGroups.Any(g =>
                    g.TrainingGroupId == m.TrainingGroupId &&
                    g.CoachId == userId.Value));
        }

        if (User.IsInRole("Athlete"))
            return userId.Value == athleteId;

        if (User.IsInRole("Parent"))
        {
            return await _db.ParentAthletes.AnyAsync(pa =>
                pa.ParentId == userId.Value &&
                pa.AthleteId == athleteId);
        }

        return false;
    }

    [HttpGet("athlete/{athleteId:int}")]
    public async Task<IActionResult> GetAthleteNotes(int athleteId)
    {
        if (!await CanAccessAthleteAsync(athleteId))
            return NotFound(new { message = "Athlete not found." });

        var currentUserId = GetCurrentUserId();

        var notes = await _db.AthleteNotes
            .AsNoTracking()
            .Where(n => n.AthleteId == athleteId)
            .OrderByDescending(n => n.CreatedAt)
            .Select(n => new
            {
                n.AthleteNoteId,
                n.AthleteId,
                n.AuthorUserId,
                n.TrainingId,
                n.Type,
                n.Text,
                n.CreatedAt,
                n.EditedAt,
                CanEdit = currentUserId.HasValue &&
                          n.AuthorUserId == currentUserId.Value
            })
            .ToListAsync();

        return Ok(notes);
    }

    [HttpPost("athlete/{athleteId:int}")]
    public async Task<IActionResult> CreateAthleteNote(
        int athleteId,
        CreateAthleteNoteDto dto)
    {
        var userId = GetCurrentUserId();
        var noteType = GetCurrentNoteType();

        if (userId is null)
            return Unauthorized();

        if (noteType is null)
            return Forbid();

        if (!await CanAccessAthleteAsync(athleteId))
            return NotFound(new { message = "Athlete not found." });

        if (string.IsNullOrWhiteSpace(dto.Text))
        {
            return BadRequest(new
            {
                message = "Note text cannot be empty."
            });
        }

        if (dto.TrainingId.HasValue)
        {
            var trainingBelongsToAthlete =
                await _db.TrainingParticipants.AnyAsync(p =>
                    p.TrainingId == dto.TrainingId.Value &&
                    p.AthleteId == athleteId);

            if (!trainingBelongsToAthlete)
            {
                return BadRequest(new
                {
                    message = "Training is not assigned to this athlete."
                });
            }

            var trainingExists = await _db.Trainings.AnyAsync(t =>
                t.TrainingId == dto.TrainingId.Value);

            if (!trainingExists)
            {
                return BadRequest(new
                {
                    message = "Training not found."
                });
            }
        }

        var note = new AthleteNote
        {
            AthleteId = athleteId,
            AuthorUserId = userId.Value,
            Type = noteType.Value,
            Text = dto.Text.Trim(),
            TrainingId = dto.TrainingId,
            CreatedAt = DateTime.UtcNow
        };

        _db.AthleteNotes.Add(note);
        await _db.SaveChangesAsync();

        return Created(
            $"/api/AthleteNotes/athlete/{athleteId}",
            new
            {
                note.AthleteNoteId,
                note.AthleteId,
                note.AuthorUserId,
                note.TrainingId,
                note.Type,
                note.Text,
                note.CreatedAt,
                CanEdit = true
            });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateAthleteNote(
        int id,
        CreateAthleteNoteDto dto)
    {
        var userId = GetCurrentUserId();

        if (userId is null)
            return Unauthorized();

        var note = await _db.AthleteNotes
            .FirstOrDefaultAsync(n => n.AthleteNoteId == id);

        if (note is null)
            return NotFound(new { message = "Note not found." });

        if (note.AuthorUserId != userId.Value)
            return Forbid();

        if (string.IsNullOrWhiteSpace(dto.Text))
        {
            return BadRequest(new
            {
                message = "Note text cannot be empty."
            });
        }

        if (dto.TrainingId.HasValue)
        {
            var trainingBelongsToAthlete =
                await _db.TrainingParticipants.AnyAsync(p =>
                    p.TrainingId == dto.TrainingId.Value &&
                    p.AthleteId == note.AthleteId);

            if (!trainingBelongsToAthlete)
            {
                return BadRequest(new
                {
                    message = "Training is not assigned to this athlete."
                });
            }
        }

        note.Text = dto.Text.Trim();
        note.TrainingId = dto.TrainingId;
        note.EditedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteAthleteNote(int id)
    {
        var userId = GetCurrentUserId();

        if (userId is null)
            return Unauthorized();

        var note = await _db.AthleteNotes
            .FirstOrDefaultAsync(n => n.AthleteNoteId == id);

        if (note is null)
            return NotFound(new { message = "Note not found." });

        if (note.AuthorUserId != userId.Value)
            return Forbid();

        _db.AthleteNotes.Remove(note);
        await _db.SaveChangesAsync();

        return NoContent();
    }
}
