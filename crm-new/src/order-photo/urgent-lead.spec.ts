import { urgentLeadFee } from './urgent-lead';
import { deadlineOnAccept, URGENT_DEADLINE_MS } from './deadline-start';
import { EnumProductCategory, EnumStatus } from 'src/generated/prisma/enums';

describe('срочная заявка с сайта', () => {
  it('надбавка 30% от печати, как на сайте', () => {
    expect(urgentLeadFee(1000)).toBe(300);
    expect(urgentLeadFee(115)).toBe(35);
    expect(urgentLeadFee(0)).toBe(0);
  });

  it('срок срочного заказа — сутки с момента, как заявку взяли в работу', () => {
    const now = new Date('2026-11-28T10:00:00Z');
    const { deadline } = deadlineOnAccept(
      {
        status: EnumStatus.LEAD,
        deadline: null,
        productCategory: EnumProductCategory.PHOTO,
        isUrgent: true,
      },
      EnumStatus.NEW,
      now,
    );
    expect(deadline?.getTime()).toBe(now.getTime() + URGENT_DEADLINE_MS);
  });
});
