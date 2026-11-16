
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class ConvertAthletesToIndependentProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Убираем старые связи с AspNetUsers.
            migrationBuilder.DropForeignKey(
                name: "FK_AthleteNotes_AspNetUsers_AthleteId",
                table: "AthleteNotes");

            migrationBuilder.DropForeignKey(
                name: "FK_AthleteProfiles_AspNetUsers_UserId",
                table: "AthleteProfiles");

            migrationBuilder.DropForeignKey(
                name: "FK_GroupMemberships_AspNetUsers_AthleteId",
                table: "GroupMemberships");

            migrationBuilder.DropForeignKey(
                name: "FK_ParentAthletes_AspNetUsers_AthleteId",
                table: "ParentAthletes");

            migrationBuilder.DropForeignKey(
                name: "FK_PhysicalMeasurements_AspNetUsers_AthleteId",
                table: "PhysicalMeasurements");

            migrationBuilder.DropForeignKey(
                name: "FK_TrainingParticipants_AspNetUsers_AthleteId",
                table: "TrainingParticipants");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ParentAthlete_NotSelf",
                table: "ParentAthletes");

            migrationBuilder.DropPrimaryKey(
                name: "PK_AthleteProfiles",
                table: "AthleteProfiles");

            // 2. Переименовываем AthleteId в таблицах истории.
            migrationBuilder.RenameColumn(
                name: "AthleteId",
                table: "TrainingParticipants",
                newName: "AthleteProfileId");

            migrationBuilder.RenameIndex(
                name: "IX_TrainingParticipants_TrainingId_AthleteId",
                table: "TrainingParticipants",
                newName: "IX_TrainingParticipants_TrainingId_AthleteProfileId");

            migrationBuilder.RenameIndex(
                name: "IX_TrainingParticipants_AthleteId",
                table: "TrainingParticipants",
                newName: "IX_TrainingParticipants_AthleteProfileId");

            migrationBuilder.RenameColumn(
                name: "AthleteId",
                table: "PhysicalMeasurements",
                newName: "AthleteProfileId");

            migrationBuilder.RenameIndex(
                name: "IX_PhysicalMeasurements_AthleteId_Type_MeasuredAt",
                table: "PhysicalMeasurements",
                newName: "IX_PhysicalMeasurements_AthleteProfileId_Type_MeasuredAt");

            migrationBuilder.RenameIndex(
                name: "IX_PhysicalMeasurements_AthleteId_GroupMetricId_MeasuredAt",
                table: "PhysicalMeasurements",
                newName: "IX_PhysicalMeasurements_AthleteProfileId_GroupMetricId_Measure~");

            migrationBuilder.RenameColumn(
                name: "AthleteId",
                table: "ParentAthletes",
                newName: "AthleteProfileId");

            migrationBuilder.RenameIndex(
                name: "IX_ParentAthletes_AthleteId",
                table: "ParentAthletes",
                newName: "IX_ParentAthletes_AthleteProfileId");

            migrationBuilder.RenameColumn(
                name: "AthleteId",
                table: "GroupMemberships",
                newName: "AthleteProfileId");

            migrationBuilder.RenameIndex(
                name: "IX_GroupMemberships_TrainingGroupId_AthleteId",
                table: "GroupMemberships",
                newName: "IX_GroupMemberships_TrainingGroupId_AthleteProfileId");

            migrationBuilder.RenameIndex(
                name: "IX_GroupMemberships_AthleteId",
                table: "GroupMemberships",
                newName: "IX_GroupMemberships_AthleteProfileId");

            migrationBuilder.RenameColumn(
                name: "AthleteId",
                table: "AthleteNotes",
                newName: "AthleteProfileId");

            migrationBuilder.RenameIndex(
                name: "IX_AthleteNotes_AthleteId",
                table: "AthleteNotes",
                newName: "IX_AthleteNotes_AthleteProfileId");

            // 3. Меняем структуру AthleteProfiles.
            migrationBuilder.AlterColumn<int>(
                name: "UserId",
                table: "AthleteProfiles",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<int>(
                name: "AthleteProfileId",
                table: "AthleteProfiles",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CreatedByUserId",
                table: "AthleteProfiles",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "AthleteProfiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "AthleteProfiles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Surname",
                table: "AthleteProfiles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            // 4. Сохраняем старые ID профилей:
            // AthleteProfileId = UserId.
            migrationBuilder.Sql("""
                UPDATE "AthleteProfiles"
                SET "AthleteProfileId" = "UserId";

                UPDATE "AthleteProfiles" ap
                SET
                    "Name" = u."Name",
                    "Surname" = u."Surname"
                FROM "AspNetUsers" u
                WHERE u."Id" = ap."UserId";
                """);

            // 5. Создаём профили для всех Athlete без профиля,
            // а также для пользователей, на которых ссылается история.
            migrationBuilder.Sql("""
                WITH athlete_user_ids AS (
                    SELECT u."Id"
                    FROM "AspNetUsers" u
                    INNER JOIN "AspNetUserRoles" ur
                        ON ur."UserId" = u."Id"
                    INNER JOIN "AspNetRoles" r
                        ON r."Id" = ur."RoleId"
                    WHERE r."Name" = 'Athlete'

                    UNION

                    SELECT "AthleteProfileId" FROM "GroupMemberships"

                    UNION

                    SELECT "AthleteProfileId" FROM "TrainingParticipants"

                    UNION

                    SELECT "AthleteProfileId" FROM "PhysicalMeasurements"

                    UNION

                    SELECT "AthleteProfileId" FROM "AthleteNotes"

                    UNION

                    SELECT "AthleteProfileId" FROM "ParentAthletes"
                )
                INSERT INTO "AthleteProfiles"
                (
                    "AthleteProfileId",
                    "UserId",
                    "Name",
                    "Surname",
                    "Gender",
                    "BeltColor",
                    "WeightCategory",
                    "CreatedByUserId",
                    "IsArchived"
                )
                SELECT
                    u."Id",
                    u."Id",
                    u."Name",
                    u."Surname",
                    0,
                    NULL,
                    0,
                    NULL,
                    false
                FROM athlete_user_ids ids
                INNER JOIN "AspNetUsers" u
                    ON u."Id" = ids."Id"
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM "AthleteProfiles" ap
                    WHERE ap."UserId" = u."Id"
                );
                """);

            // 6. Проверяем, что каждому старому ID соответствует профиль.
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM (
                            SELECT "AthleteProfileId" AS athlete_id
                            FROM "GroupMemberships"
                            UNION
                            SELECT "AthleteProfileId"
                            FROM "TrainingParticipants"
                            UNION
                            SELECT "AthleteProfileId"
                            FROM "PhysicalMeasurements"
                            UNION
                            SELECT "AthleteProfileId"
                            FROM "AthleteNotes"
                            UNION
                            SELECT "AthleteProfileId"
                            FROM "ParentAthletes"
                        ) refs
                        LEFT JOIN "AthleteProfiles" ap
                            ON ap."AthleteProfileId" = refs.athlete_id
                        WHERE ap."AthleteProfileId" IS NULL
                    ) THEN
                        RAISE EXCEPTION
                            'Migration stopped: an athlete reference has no profile';
                    END IF;
                END $$;
                """);

            migrationBuilder.AlterColumn<int>(
                name: "AthleteProfileId",
                table: "AthleteProfiles",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.Sql("""
                ALTER TABLE "AthleteProfiles"
                ALTER COLUMN "AthleteProfileId"
                ADD GENERATED BY DEFAULT AS IDENTITY;

                SELECT setval(
                    pg_get_serial_sequence('"AthleteProfiles"', 'AthleteProfileId'),
                    COALESCE(MAX("AthleteProfileId"), 1),
                    MAX("AthleteProfileId") IS NOT NULL
                )
                FROM "AthleteProfiles";
                """);

            migrationBuilder.AddPrimaryKey(
                name: "PK_AthleteProfiles",
                table: "AthleteProfiles",
                column: "AthleteProfileId");

            // 7. Индексы профилей.
            migrationBuilder.CreateIndex(
                name: "IX_AthleteProfiles_CreatedByUserId",
                table: "AthleteProfiles",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_AthleteProfiles_UserId",
                table: "AthleteProfiles",
                column: "UserId",
                unique: true);

            // 8. Новые внешние ключи.
            migrationBuilder.AddForeignKey(
                name: "FK_AthleteNotes_AthleteProfiles_AthleteProfileId",
                table: "AthleteNotes",
                column: "AthleteProfileId",
                principalTable: "AthleteProfiles",
                principalColumn: "AthleteProfileId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_AthleteProfiles_AspNetUsers_CreatedByUserId",
                table: "AthleteProfiles",
                column: "CreatedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_AthleteProfiles_AspNetUsers_UserId",
                table: "AthleteProfiles",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_GroupMemberships_AthleteProfiles_AthleteProfileId",
                table: "GroupMemberships",
                column: "AthleteProfileId",
                principalTable: "AthleteProfiles",
                principalColumn: "AthleteProfileId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ParentAthletes_AthleteProfiles_AthleteProfileId",
                table: "ParentAthletes",
                column: "AthleteProfileId",
                principalTable: "AthleteProfiles",
                principalColumn: "AthleteProfileId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PhysicalMeasurements_AthleteProfiles_AthleteProfileId",
                table: "PhysicalMeasurements",
                column: "AthleteProfileId",
                principalTable: "AthleteProfiles",
                principalColumn: "AthleteProfileId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_TrainingParticipants_AthleteProfiles_AthleteProfileId",
                table: "TrainingParticipants",
                column: "AthleteProfileId",
                principalTable: "AthleteProfiles",
                principalColumn: "AthleteProfileId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AthleteNotes_AthleteProfiles_AthleteProfileId",
                table: "AthleteNotes");

            migrationBuilder.DropForeignKey(
                name: "FK_AthleteProfiles_AspNetUsers_CreatedByUserId",
                table: "AthleteProfiles");

            migrationBuilder.DropForeignKey(
                name: "FK_AthleteProfiles_AspNetUsers_UserId",
                table: "AthleteProfiles");

            migrationBuilder.DropForeignKey(
                name: "FK_GroupMemberships_AthleteProfiles_AthleteProfileId",
                table: "GroupMemberships");

            migrationBuilder.DropForeignKey(
                name: "FK_ParentAthletes_AthleteProfiles_AthleteProfileId",
                table: "ParentAthletes");

            migrationBuilder.DropForeignKey(
                name: "FK_PhysicalMeasurements_AthleteProfiles_AthleteProfileId",
                table: "PhysicalMeasurements");

            migrationBuilder.DropForeignKey(
                name: "FK_TrainingParticipants_AthleteProfiles_AthleteProfileId",
                table: "TrainingParticipants");

            migrationBuilder.DropPrimaryKey(
                name: "PK_AthleteProfiles",
                table: "AthleteProfiles");

            migrationBuilder.DropIndex(
                name: "IX_AthleteProfiles_CreatedByUserId",
                table: "AthleteProfiles");

            migrationBuilder.DropIndex(
                name: "IX_AthleteProfiles_UserId",
                table: "AthleteProfiles");

            migrationBuilder.DropColumn(
                name: "AthleteProfileId",
                table: "AthleteProfiles");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "AthleteProfiles");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "AthleteProfiles");

            migrationBuilder.DropColumn(
                name: "Name",
                table: "AthleteProfiles");

            migrationBuilder.DropColumn(
                name: "Surname",
                table: "AthleteProfiles");

            migrationBuilder.RenameColumn(
                name: "AthleteProfileId",
                table: "TrainingParticipants",
                newName: "AthleteId");

            migrationBuilder.RenameIndex(
                name: "IX_TrainingParticipants_TrainingId_AthleteProfileId",
                table: "TrainingParticipants",
                newName: "IX_TrainingParticipants_TrainingId_AthleteId");

            migrationBuilder.RenameIndex(
                name: "IX_TrainingParticipants_AthleteProfileId",
                table: "TrainingParticipants",
                newName: "IX_TrainingParticipants_AthleteId");

            migrationBuilder.RenameColumn(
                name: "AthleteProfileId",
                table: "PhysicalMeasurements",
                newName: "AthleteId");

            migrationBuilder.RenameIndex(
                name: "IX_PhysicalMeasurements_AthleteProfileId_Type_MeasuredAt",
                table: "PhysicalMeasurements",
                newName: "IX_PhysicalMeasurements_AthleteId_Type_MeasuredAt");

            migrationBuilder.RenameIndex(
                name: "IX_PhysicalMeasurements_AthleteProfileId_GroupMetricId_Measure~",
                table: "PhysicalMeasurements",
                newName: "IX_PhysicalMeasurements_AthleteId_GroupMetricId_MeasuredAt");

            migrationBuilder.RenameColumn(
                name: "AthleteProfileId",
                table: "ParentAthletes",
                newName: "AthleteId");

            migrationBuilder.RenameIndex(
                name: "IX_ParentAthletes_AthleteProfileId",
                table: "ParentAthletes",
                newName: "IX_ParentAthletes_AthleteId");

            migrationBuilder.RenameColumn(
                name: "AthleteProfileId",
                table: "GroupMemberships",
                newName: "AthleteId");

            migrationBuilder.RenameIndex(
                name: "IX_GroupMemberships_TrainingGroupId_AthleteProfileId",
                table: "GroupMemberships",
                newName: "IX_GroupMemberships_TrainingGroupId_AthleteId");

            migrationBuilder.RenameIndex(
                name: "IX_GroupMemberships_AthleteProfileId",
                table: "GroupMemberships",
                newName: "IX_GroupMemberships_AthleteId");

            migrationBuilder.RenameColumn(
                name: "AthleteProfileId",
                table: "AthleteNotes",
                newName: "AthleteId");

            migrationBuilder.RenameIndex(
                name: "IX_AthleteNotes_AthleteProfileId",
                table: "AthleteNotes",
                newName: "IX_AthleteNotes_AthleteId");

            migrationBuilder.AlterColumn<int>(
                name: "UserId",
                table: "AthleteProfiles",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_AthleteProfiles",
                table: "AthleteProfiles",
                column: "UserId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ParentAthlete_NotSelf",
                table: "ParentAthletes",
                sql: "\"ParentId\" <> \"AthleteId\"");

            migrationBuilder.AddForeignKey(
                name: "FK_AthleteNotes_AspNetUsers_AthleteId",
                table: "AthleteNotes",
                column: "AthleteId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_AthleteProfiles_AspNetUsers_UserId",
                table: "AthleteProfiles",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_GroupMemberships_AspNetUsers_AthleteId",
                table: "GroupMemberships",
                column: "AthleteId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ParentAthletes_AspNetUsers_AthleteId",
                table: "ParentAthletes",
                column: "AthleteId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PhysicalMeasurements_AspNetUsers_AthleteId",
                table: "PhysicalMeasurements",
                column: "AthleteId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_TrainingParticipants_AspNetUsers_AthleteId",
                table: "TrainingParticipants",
                column: "AthleteId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
