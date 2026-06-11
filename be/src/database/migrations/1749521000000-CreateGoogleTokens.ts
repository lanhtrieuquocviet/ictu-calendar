import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGoogleTokens1749521000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`google_tokens\` (
        \`id\`           varchar(36)   NOT NULL,
        \`userId\`       varchar(36)   NOT NULL,
        \`accessToken\`  text          NOT NULL,
        \`refreshToken\` text          NULL,
        \`tokenExpiry\`  datetime      NULL,
        \`updatedAt\`    datetime(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                                ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_google_tokens_userId\` (\`userId\`)
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
        `ALTER TABLE \`google_tokens\`
          MODIFY COLUMN \`userId\` varchar(36)
            CHARACTER SET ${colInfo.CHARACTER_SET_NAME}
            COLLATE ${colInfo.COLLATION_NAME} NOT NULL`,
      );
    }

    const [fkExists] = await queryRunner.query(`
      SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'google_tokens'
        AND CONSTRAINT_NAME = 'FK_google_tokens_userId'
    `);
    if (!fkExists) {
      await queryRunner.query(`
        ALTER TABLE \`google_tokens\`
          ADD CONSTRAINT \`FK_google_tokens_userId\`
            FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`google_tokens\``);
  }
}
