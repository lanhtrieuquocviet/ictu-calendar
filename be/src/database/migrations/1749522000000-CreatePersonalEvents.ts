import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePersonalEvents1749522000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`personal_events\` (
        \`id\`            varchar(36)   NOT NULL,
        \`userId\`        varchar(36)   NOT NULL,
        \`googleEventId\` varchar(255)  NULL,
        \`title\`         varchar(255)  NOT NULL,
        \`eventDate\`     date          NOT NULL,
        \`startTime\`     time          NULL,
        \`endTime\`       time          NULL,
        \`allDay\`        tinyint       NOT NULL DEFAULT 0,
        \`location\`      varchar(255)  NULL,
        \`description\`   text          NULL,
        \`color\`         varchar(50)   NULL,
        \`syncedAt\`      timestamp     NULL,
        \`createdAt\`     datetime(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`     datetime(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                                 ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`IDX_personal_events_userId_googleEventId\` (\`userId\`, \`googleEventId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Đọc charset/collation thực tế của users.id để đảm bảo FK tương thích
    const [colInfo] = await queryRunner.query(`
      SELECT CHARACTER_SET_NAME, COLLATION_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'id'
    `);
    if (colInfo) {
      await queryRunner.query(
        `ALTER TABLE \`personal_events\`
          MODIFY COLUMN \`userId\` varchar(36)
            CHARACTER SET ${colInfo.CHARACTER_SET_NAME}
            COLLATE ${colInfo.COLLATION_NAME} NOT NULL`,
      );
    }

    const [fkExists] = await queryRunner.query(`
      SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'personal_events'
        AND CONSTRAINT_NAME = 'FK_personal_events_userId'
    `);
    if (!fkExists) {
      await queryRunner.query(`
        ALTER TABLE \`personal_events\`
          ADD CONSTRAINT \`FK_personal_events_userId\`
            FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`personal_events\``);
  }
}
