// client/src/components/common/OfflineIndicator.js
import React from 'react';

const OfflineIndicator = () => {
  return (
    <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 z-50">
      <span className="text-sm font-semibold">
        📡 오프라인 모드 - 일부 기능이 제한될 수 있습니다
      </span>
    </div>
  );
};

export default OfflineIndicator;
