import React from 'react';
import { X, PlaySquare, Settings2, Sparkles, LogIn } from 'lucide-react';

interface Props {
  onClose: () => void;
  onStartTour: () => void;
}

export const AboutModal: React.FC<Props> = ({ onClose, onStartTour }) => {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#16161a] border border-[#3f3f46] rounded-xl w-full max-w-2xl flex flex-col shadow-2xl max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-[#3f3f46] shrink-0">
          <h2 className="text-xl font-bold text-white"><span className="text-[#f59e8b] tracking-tighter">CuePlay</span>とは</h2>
          <button onClick={onClose} className="text-[#a1a1aa] hover:text-white"><X size={24} /></button>
        </div>
        
        <div className="p-6 flex flex-col gap-6 text-[#a1a1aa] overflow-y-auto custom-scrollbar">
          
          <div className="text-sm leading-relaxed mb-4 text-[#d4d4d8]">
            <strong className="text-[#f59e8b] tracking-tighter text-base pr-1">CuePlay</strong><strong className="text-white"> (キュープレイ) </strong> は、ブラウザ上で動作するアナログ風サンプラーです。
            音声ファイル（mp3, wav等）を読み込んで、直感的な操作で再生・編集が可能。演劇や配信のポン出しなどにも活用できます。
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="flex gap-4 items-start">
              <div className="bg-[#202026] p-2 rounded-lg text-[#f59e8b] shrink-0"><PlaySquare size={20} /></div>
              <div>
                <p className="text-white font-bold mb-1">直感的なパッドプレイ</p>
                <p>合計120個のオーディオパッド機能（ページごと切り替え）。マイク録音や、多様な再生モード（1-SHOT, RETRIGGER, TOGGLE, GATE）に対応。</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="bg-[#202026] p-2 rounded-lg text-[#f59e8b] shrink-0"><Settings2 size={20} /></div>
              <div>
                <p className="text-white font-bold mb-1">詳細なトラック機能</p>
                <p>音量・ピッチ・トリム設定のほか、リバーブやディレイ、更にRadioやMuffleのような特殊エフェクト、Mute/Soloをパッド毎に設定できます。</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="bg-[#202026] p-2 rounded-lg text-[#f59e8b] shrink-0"><Sparkles size={20} /></div>
              <div>
                <p className="text-white font-bold mb-1">ミキサー＆マスター機能</p>
                <p>各チャンネルや全体の音量調整、3バンドEQ、マスターエフェクト（Reverb, Delay等）を備え、本格的なサウンドメイクが可能です。</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="bg-[#202026] p-2 rounded-lg text-[#f59e8b] shrink-0"><LogIn size={20} /></div>
              <div>
                <p className="text-white font-bold mb-1">プロジェクトの保存と読込</p>
                <p>設定やアサインしたサンプルをJSONファイルとして保存・復元できます（ブラウザの環境によってはサウンド込みで保存可能です）。</p>
              </div>
            </div>
          </div>
          
          <div className="border-t border-[#3f3f46] mt-2 pt-4 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => {
                  onClose();
                  onStartTour();
                }}
                className="flex-1 bg-[#202026] hover:bg-[#27272f] border border-[#3f3f46] text-white font-bold py-3.5 rounded-lg transition-colors text-sm"
              >
                使い方のツアーを開始
              </button>
              <button 
                onClick={onClose}
                className="flex-1 bg-gradient-to-r from-[#f59e8b] to-[#a78bfa] hover:opacity-80 text-black font-bold py-3.5 rounded-lg transition-colors text-sm"
              >
                さあ、始めましょう！
              </button>
            </div>
            
            <div className="text-center text-xs text-[#718096] mt-4 tracking-widest uppercase">
              Developed by <span className="text-[#a1a1aa] font-bold">PORIDE / のりのり</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
