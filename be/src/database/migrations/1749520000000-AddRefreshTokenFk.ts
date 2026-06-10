import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefreshTokenFk1749520000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Xóa các token mồ côi (userId không tồn tại trong bảng users)
    // trước khi thêm FK constraint, tránh lỗi "Cannot add or update a child row"
    await queryRunner.query(`
      DELETE FROM refresh_tokens
      WHERE userId NOT IN (SELECT id FROM users)
    `);

    const [fkExists] = await queryRunner.query(`
      SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'refresh_tokens'
        AND CONSTRAINT_NAME = 'FK_610102b60fea1455310ccd299de'
    `);

    if (!fkExists) {
      await queryRunner.query(`
        ALTER TABLE refresh_tokens
        ADD CONSTRAINT FK_610102b60fea1455310ccd299de
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE refresh_tokens
      DROP FOREIGN KEY FK_610102b60fea1455310ccd299de
    `);
  }
}
