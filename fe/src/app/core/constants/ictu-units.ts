export interface UnitGroup {
  label: string;
  units: string[];
}

export const ICTU_UNIT_GROUPS: UnitGroup[] = [
  {
    label: 'Lãnh đạo',
    units: [
      'Đảng ủy',
      'Ban Giám hiệu',
      'Các Hội đồng Tư vấn',
    ],
  },
  {
    label: 'Các Phòng chức năng',
    units: [
      'Phòng Hành chính Tổ chức',
      'Phòng Kế hoạch Đầu tư và Tài chính',
      'Phòng Đào tạo',
      'Phòng Khoa học Công nghệ và HTQT',
      'Phòng Công tác Người học',
    ],
  },
  {
    label: 'Các Khoa chuyên môn',
    units: [
      'Khoa Khoa học Cơ bản',
      'Khoa Công nghệ Thông tin',
      'Khoa Kinh tế và Quản trị',
      'Khoa Kỹ thuật và Công nghệ',
      'Khoa Nghệ thuật và Truyền thông',
    ],
  },
  {
    label: 'Các Trung tâm',
    units: [
      'Trung tâm Truyền thông Tuyển sinh',
      'Trung tâm Tin học, NN&BTTNC',
      'Trung tâm Phát triển Phần mềm',
      'Trung tâm Hợp tác Doanh nghiệp',
    ],
  },
  {
    label: 'Các Viện',
    units: [
      'Viện Đào tạo Quốc tế',
      'Viện Khoa học và Công nghệ Ứng dụng',
      'Viện Trí tuệ Nhân tạo',
      'Viện Đổi mới Sáng tạo và Chuyển giao Công nghệ',
    ],
  },
  {
    label: 'Các tổ chức Đoàn thể',
    units: [
      'Công đoàn',
      'Đoàn Thanh niên',
      'Chi hội Cựu Chiến binh',
      'Hội Sinh viên',
      'Hội Cựu Giáo chức',
    ],
  },
];

/** Danh sách phẳng tất cả đơn vị, dùng cho autocomplete / filter */
export const ICTU_ALL_UNITS: string[] = ICTU_UNIT_GROUPS.flatMap(g => g.units);
