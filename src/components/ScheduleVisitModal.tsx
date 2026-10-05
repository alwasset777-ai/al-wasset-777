import React, { useState } from 'react';
import { appointmentsStore, newAppointmentId } from '../services/officeStores';
import { sendToAgency } from '../services/inbox';
import { X, Calendar, Clock, User, Phone, CheckCircle2, Sparkles } from 'lucide-react';
import { Property, Language } from '../types';

interface ScheduleVisitModalProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export const ScheduleVisitModal: React.FC<ScheduleVisitModalProps> = ({
  property,
  isOpen,
  onClose,
  language
}) => {
  const isAr = language === 'ar';
  const isEn = language === 'en';
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('15:00');
  const [visitorName, setVisitorName] = useState('Ahmed Mansouri');
  const [visitorPhone, setVisitorPhone] = useState('+212 6 61 23 45 67');
  const [isSuccess, setIsSuccess] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

  if (!isOpen || !property) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const at = selectedDate ? new Date(`${selectedDate}T${selectedTime}`).toISOString() : new Date().toISOString();
    const title = isAr ? property.titleAr : property.titleFr;
    // Trace locale (visible dans « Rendez-vous ») + envoi au bureau (en ligne ou WhatsApp).
    appointmentsStore.set((prev) => [
      {
        id: newAppointmentId(),
        title: `Visite – ${title}`,
        clientName: visitorName,
        clientPhone: visitorPhone,
        propertyId: property.id,
        propertyTitle: title,
        at,
        notes: '',
        status: 'demandé',
        source: 'site',
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    const res = await sendToAgency({
      kind: 'visite',
      name: visitorName,
      phone: visitorPhone,
      message: '',
      propertyId: property.id,
      propertyTitle: title,
      preferredAt: at,
    });
    setWhatsappUrl(res.sent ? null : res.whatsappUrl);
    setIsSuccess(true);
    if (res.sent) {
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 2500);
    }
  };

  const timeSlots = ['10:00', '11:30', '14:00', '15:00', '16:30', '18:00'];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full border border-[#f0e4e2] shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="p-5 border-b border-[#f2e6e4] flex items-center justify-between bg-[#fff8f7]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#fff0ed] text-[#ff6f61] flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <h2 className="text-base font-extrabold text-[#281715]">
              {isAr ? 'حجز موعد زيارة العقار' : isEn ? 'Schedule Property Visit' : 'Programmer une visite'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white text-[#7a5c58] hover:text-[#281715] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {isSuccess ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#ecfdf5] text-[#059669] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-extrabold text-[#281715]">
              {isAr ? 'تم تأكيد طلب الزيارة بنجاح!' : isEn ? 'Visit Request Submitted Successfully!' : 'Demande de visite enregistrée !'}
            </h3>
            <p className="text-xs text-[#7a5c58]">
              {isAr
                ? 'سيقوم الوكيل بالتواصل معك لتأكيد الموعد عبر الواتساب.'
                : isEn
                ? 'The agent will contact you shortly via WhatsApp to confirm the appointment slot.'
                : 'L’agent vous contactera très rapidement pour confirmer le créneau.'}
            </p>
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setTimeout(() => { setIsSuccess(false); onClose(); }, 500)}
                className="inline-block mt-2 px-4 py-2.5 rounded-xl bg-[#25d366] text-white text-xs font-extrabold"
              >
                {isAr ? 'أرسل الطلب عبر واتساب' : isEn ? 'Send via WhatsApp' : 'Envoyer via WhatsApp'}
              </a>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            
            {/* Property Snippet */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#fff8f7] border border-[#f0e4e2]">
              <img
                src={property.images[0]}
                alt=""
                className="w-12 h-12 rounded-xl object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0 flex-1">
                <h4 className="font-extrabold text-[#281715] truncate">
                  {isAr ? property.titleAr : isEn && property.titleEn ? property.titleEn : property.titleFr}
                </h4>
                <span className="text-[#ff6f61] font-bold block">
                  {isAr ? property.priceFormattedAr : isEn && property.priceFormattedEn ? property.priceFormattedEn : property.priceFormattedFr}
                </span>
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#5a4340] mb-1">
                {isAr ? 'تاريخ الزيارة المفضل' : isEn ? 'Preferred Date' : 'Date souhaitée'}
              </label>
              <input
                type="date"
                required
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#fff8f7] rounded-xl border border-[#f0e4e2] text-[#281715]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#5a4340] mb-1.5">
                {isAr ? 'التوقيت المفضل' : isEn ? 'Preferred Time Slot' : 'Créneau horaire'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {timeSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedTime(slot)}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      selectedTime === slot
                        ? 'bg-[#ff6f61] text-white border-transparent'
                        : 'bg-[#fff8f7] text-[#5a4340] border-[#f0e4e2]'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#5a4340] mb-1">
                {isAr ? 'الاسم الكامل' : isEn ? 'Your Full Name' : 'Votre nom'}
              </label>
              <input
                type="text"
                required
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                className="w-full px-3 py-2 bg-[#fff8f7] rounded-xl border border-[#f0e4e2] text-[#281715]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#5a4340] mb-1">
                {isAr ? 'رقم الهاتف' : isEn ? 'Phone Number' : 'Numéro de téléphone'}
              </label>
              <input
                type="tel"
                required
                value={visitorPhone}
                onChange={(e) => setVisitorPhone(e.target.value)}
                className="w-full px-3 py-2 bg-[#fff8f7] rounded-xl border border-[#f0e4e2] text-[#281715]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#ff6f61] hover:bg-[#e8584a] text-white font-bold shadow-md shadow-[#ff6f61]/25 cursor-pointer transition-all"
            >
              {isAr ? 'تأكيد طلب الزيارة' : isEn ? 'Confirm Visit Booking' : 'Confirmer la demande'}
            </button>

          </form>
        )}

      </div>
    </div>
  );
};
