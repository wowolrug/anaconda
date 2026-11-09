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
[Authorize(Roles = "Coach")]
public class GroupMetricsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public GroupMetricsController(ApplicationDbContext context)
    {
        _context = context;
    }

    private int GetCurrentUserId()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        return int.TryParse(userId, out var id) ? id : 0;
    }

    // Получение всех метрик группы, включая архивные.
    [HttpGet("group/{groupId:int}")]
    public async Task<IActionResult> GetGroupMetrics(int groupId)
    {
        var coachId = GetCurrentUserId();

        var groupExists = await _context.TrainingGroups
            .AnyAsync(g =>
                g.TrainingGroupId == groupId &&
                g.CoachId == coachId);

        if (!groupExists)
            return NotFound(new { message = "Группа не найдена." });

        var metrics = await _context.GroupMetrics
            .AsNoTracking()
            .Where(m => m.TrainingGroupId == groupId)
            .OrderByDescending(m => m.IsActive)
            .ThenBy(m => m.Name)
            .Select(m => new
            {
                m.GroupMetricId,
                m.TrainingGroupId,
                m.Name,
                m.Unit,
                m.IsActive,
                m.CreatedAt
            })
            .ToListAsync();

        return Ok(metrics);
    }

    // Создание новой метрики.
    [HttpPost("group/{groupId:int}")]
    public async Task<IActionResult> CreateGroupMetric(
        int groupId,
        [FromBody] CreateGroupMetricDto dto)
    {
        var coachId = GetCurrentUserId();

        var group = await _context.TrainingGroups
            .FirstOrDefaultAsync(g =>
                g.TrainingGroupId == groupId &&
                g.CoachId == coachId);

        if (group == null)
            return NotFound(new { message = "Группа не найдена." });

        var name = dto.Name.Trim();
        var unit = dto.Unit.Trim();

        if (string.IsNullOrWhiteSpace(name))
            return BadRequest(new { message = "Укажите название метрики." });

        if (string.IsNullOrWhiteSpace(unit))
            return BadRequest(new { message = "Укажите единицу измерения." });

        var alreadyExists = await _context.GroupMetrics
            .AnyAsync(m =>
                m.TrainingGroupId == groupId &&
                m.Name == name);

        if (alreadyExists)
            return Conflict(new
            {
                message = "Метрика с таким названием уже существует в этой группе."
            });

        var metric = new GroupMetric
        {
            TrainingGroupId = groupId,
            Name = name,
            Unit = unit,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.GroupMetrics.Add(metric);
        await _context.SaveChangesAsync();

        return CreatedAtAction(
            nameof(GetGroupMetrics),
            new { groupId },
            new
            {
                metric.GroupMetricId,
                metric.TrainingGroupId,
                metric.Name,
                metric.Unit,
                metric.IsActive,
                metric.CreatedAt
            });
    }

    // Архивирование метрики.
    [HttpPatch("{metricId:int}/archive")]
    public async Task<IActionResult> ArchiveMetric(int metricId)
    {
        var coachId = GetCurrentUserId();

        var metric = await _context.GroupMetrics
            .Include(m => m.TrainingGroup)
            .FirstOrDefaultAsync(m =>
                m.GroupMetricId == metricId &&
                m.TrainingGroup.CoachId == coachId);

        if (metric == null)
            return NotFound(new { message = "Метрика не найдена." });

        if (!metric.IsActive)
            return Ok(new { message = "Метрика уже находится в архиве." });

        metric.IsActive = false;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Метрика архивирована." });
    }

    // Восстановление метрики.
    [HttpPatch("{metricId:int}/restore")]
    public async Task<IActionResult> RestoreMetric(int metricId)
    {
        var coachId = GetCurrentUserId();

        var metric = await _context.GroupMetrics
            .Include(m => m.TrainingGroup)
            .FirstOrDefaultAsync(m =>
                m.GroupMetricId == metricId &&
                m.TrainingGroup.CoachId == coachId);

        if (metric == null)
            return NotFound(new { message = "Метрика не найдена." });

        if (metric.IsActive)
            return Ok(new { message = "Метрика уже активна." });

        var nameExists = await _context.GroupMetrics
            .AnyAsync(m =>
                m.TrainingGroupId == metric.TrainingGroupId &&
                m.Name == metric.Name &&
                m.GroupMetricId != metricId);

        if (nameExists)
            return Conflict(new
            {
                message = "Нельзя восстановить метрику: в группе уже существует метрика с таким названием."
            });

        metric.IsActive = true;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Метрика восстановлена." });
    }
}