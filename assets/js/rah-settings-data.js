(function () {
  'use strict';

  // Static preview mirror of the active rows in Settings > Departments.
  // Production Apps Script replaces this through getRah01FormConfig().
  const departmentNames = Object.freeze([
    ['หอผู้ป่วยหนัก 1', 'Intensive Care Unit 1'],
    ['หอผู้ป่วยหนัก 2', 'Intensive Care Unit 2'],
    ['แผนกอุบัติเหตุและฉุกเฉิน', 'Emergency Department'],
    ['ห้องผ่าตัด', 'Operating Theatre'],
    ['ห้องปฏิบัติการทางการแพทย์', 'Medical Laboratory'],
    ['แผนกรังสีวิทยา', 'Radiology Department'],
    ['หอผู้ป่วยอายุรกรรม', 'Medical Ward'],
    ['หอผู้ป่วยศัลยกรรม', 'Surgical Ward'],
    ['หอผู้ป่วยกุมารเวชกรรม', 'Pediatric Ward'],
    ['หอผู้ป่วยสูตินรีเวชกรรม', 'OB-GYN Ward'],
    ['แผนกผู้ป่วยนอก', 'Outpatient Department'],
    ['งานเภสัชกรรม', 'Pharmacy Department'],
    ['แผนกเวชศาสตร์ฟื้นฟู', 'Rehabilitation Medicine'],
    ['แผนกทันตกรรม', 'Dental Department'],
    ['แผนกจักษุ', 'Ophthalmology Department'],
    ['แผนกโสต ศอ นาสิก', 'Otolaryngology Department'],
    ['แผนกจิตเวช', 'Psychiatry Department'],
    ['หน่วยไตเทียม', 'Hemodialysis Unit'],
    ['คลินิกโรคหัวใจ', 'Cardiology Clinic'],
    ['ศูนย์มะเร็ง', 'Cancer Center'],
    ['ธนาคารเลือด', 'Blood Bank'],
    ['งานพยาธิวิทยา', 'Pathology Department'],
    ['งานป้องกันและควบคุมการติดเชื้อ', 'Infection Prevention and Control'],
    ['งานอาชีวอนามัย', 'Occupational Health Unit'],
    ['งานส่งเสริมสุขภาพ', 'Health Promotion Unit'],
    ['แผนกวิสัญญี', 'Anesthesiology Department'],
    ['หน่วยจ่ายกลาง', 'Central Sterile Supply Department'],
    ['งานโภชนาการ', 'Nutrition Department'],
    ['งานสังคมสงเคราะห์', 'Social Work Department'],
    ['งานเวชระเบียน', 'Medical Records Department'],
    ['งานการเงิน', 'Finance Department'],
    ['งานทรัพยากรบุคคล', 'Human Resources Department'],
    ['งานเทคโนโลยีสารสนเทศ', 'Information Technology Department'],
    ['งานจัดซื้อ', 'Procurement Department'],
    ['งานพัสดุและคลัง', 'Supply and Warehouse Department'],
    ['งานวิศวกรรม', 'Engineering Department'],
    ['งานซ่อมบำรุง', 'Maintenance Department'],
    ['งานรักษาความสะอาด', 'Housekeeping Department'],
    ['งานซักฟอก', 'Laundry Department'],
    ['งานรักษาความปลอดภัย', 'Security Department'],
    ['หน่วยรถพยาบาล', 'Ambulance Unit'],
    ['ห้องเก็บศพ', 'Mortuary'],
    ['งานจัดการของเสีย', 'Waste Management Unit'],
    ['ศูนย์พัฒนาคุณภาพ', 'Quality Improvement Center'],
    ['งานบริหารความเสี่ยง', 'Risk Management Unit'],
    ['กลุ่มการพยาบาล', 'Nursing Administration'],
    ['องค์กรแพทย์', 'Medical Staff Organization'],
    ['ศูนย์การศึกษาและฝึกอบรม', 'Education and Training Center'],
    ['ศูนย์วิจัย', 'Research Center'],
    ['สำนักงานผู้อำนวยการ', 'Executive Office'],
    ['งานกฎหมาย', 'Legal Affairs'],
    ['งานประชาสัมพันธ์', 'Public Relations'],
    ['ศูนย์ลูกค้าสัมพันธ์', 'Customer Relations Center'],
    ['งานสิทธิการรักษาและเรียกเก็บ', 'Insurance and Billing'],
    ['งานรับผู้ป่วยใน', 'Admission Office'],
    ['ศูนย์นัดหมาย', 'Appointment Center'],
    ['หน่วยเคลื่อนย้ายผู้ป่วย', 'Patient Transport Unit'],
    ['งานวิศวกรรมชีวการแพทย์', 'Biomedical Engineering'],
    ['ระบบก๊าซทางการแพทย์', 'Medical Gas Systems Unit'],
    ['ครัวกลาง', 'Central Kitchen'],
    ['หอผู้ป่วยทารกแรกเกิด', 'Newborn Nursery'],
    ['ห้องคลอด', 'Delivery Room'],
    ['หอผู้ป่วยหลังคลอด', 'Postpartum Ward'],
    ['หอผู้ป่วยวิกฤตทารกแรกเกิด', 'Neonatal Intensive Care Unit'],
    ['หอผู้ป่วยวิกฤตกุมารเวชกรรม', 'Pediatric Intensive Care Unit'],
    ['หอผู้ป่วยวิกฤตโรคหัวใจ', 'Coronary Care Unit'],
    ['หน่วยโรคหลอดเลือดสมอง', 'Stroke Unit'],
    ['หอผู้ป่วยแยกโรค', 'Isolation Ward'],
    ['งานเวชกรรมสังคม', 'Community Medicine'],
    ['หน่วยบริการปฐมภูมิ', 'Primary Care Unit']
  ]);

  const departments = departmentNames.map(([nameTh, nameEn], index) => {
    const sequence = String(index + 1).padStart(3, '0');
    return Object.freeze({
      id: `DEPT-${sequence}`,
      code: `D${sequence}`,
      nameTh,
      nameEn,
      active: true,
      sortOrder: index + 1
    });
  });

  window.RAH_SETTINGS_DATA = Object.freeze({
    schemaVersion: 'rah01-form-config.v1',
    hospitalName: 'Your Hospital Name',
    departments: Object.freeze(departments)
  });
})();
