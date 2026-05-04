// client/src/components/pwa/PWAPrompt.js
import React from 'react';

const PWAPrompt = ({ onInstall }) => {
  return (
    <div className="fixed bottom-20 left-4 right-4 bg-white rounded-xl shadow-2xl p-4 z-50 border border-blue-200">
      <div className="flex items-center gap-3">
        <div className="text-2xl">📱</div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-900">앱 설치하기</h3>
          <p className="text-sm text-gray-600">
            스마트폰에 설치하여 빠르게 사용하세요
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {/* dismiss */}}
            className="px-3 py-2 text-gray-600 hover:text-gray-800"
          >
            나중에
          </button>
          <button
            onClick={onInstall}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
          >
            설치
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAPrompt;
