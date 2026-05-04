// server/middleware/validate.js
const { body, param, query, validationResult } = require('express-validator');

// 유효성 검사 결과 처리
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// 메뉴 생성 유효성 검사
const validateMenu = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('메뉴 이름은 필수입니다')
    .isLength({ max: 100 })
    .withMessage('메뉴 이름은 100자를 초과할 수 없습니다'),
  body('initialStock')
    .isInt({ min: 0 })
    .withMessage('초기 재고는 0 이상의 정수여야 합니다'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('가격은 0 이상이어야 합니다'),
  handleValidationErrors
];

// 예약 생성 유효성 검사
const validateReservation = [
  body('customerName')
    .trim()
    .notEmpty()
    .withMessage('예약자명은 필수입니다'),
  body('contactNumber')
    .matches(/^\d{2,3}-\d{3,4}-\d{4}$/)
    .withMessage('올바른 전화번호 형식이 아닙니다'),
  body('room')
    .isIn(['main', 'room2', 'room3', 'room4', 'room5', 'room6', 'room9'])
    .withMessage('올바른 회의실을 선택해주세요'),
  body('reservationDate')
    .isISO8601()
    .withMessage('올바른 날짜 형식이 아닙니다'),
  body('reservationTime')
    .isIn(['11:00', '11:30', '12:00', '12:30', '13:00', '13:30', 
           '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'])
    .withMessage('올바른 예약 시간을 선택해주세요'),
  body('numberOfGuests')
    .isInt({ min: 1, max: 50 })
    .withMessage('인원은 1-50명 사이여야 합니다'),
  handleValidationErrors
];

// 주문 생성 유효성 검사
const validateOrder = [
  body('room')
    .isIn(['main', 'room2', 'room3', 'room4', 'room5', 'room6', 'room9'])
    .withMessage('올바른 회의실을 선택해주세요'),
  body('menuId')
    .isMongoId()
    .withMessage('올바른 메뉴 ID가 아닙니다'),
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('수량은 1 이상이어야 합니다'),
  handleValidationErrors
];

module.exports = {
  validateMenu,
  validateReservation,
  validateOrder
};
