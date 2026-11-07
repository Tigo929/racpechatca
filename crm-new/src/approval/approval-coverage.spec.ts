import {
  approvalCoverage,
  dispatchBlockers,
  orderDispatchBlockers,
  type CoverageApproval,
  type CoveragePosition,
} from './approval-coverage';

/**
 * Заказ на три размера — три макета.
 *
 * Здесь решается, уйдёт ли заказ в производство. Ошибка в обе стороны
 * дорогая: пропустить незакрытую позицию значит напечатать не то, что
 * купили; закрыть дорогу готовому заказу значит остановить работу.
 */

const position = (
  id: string,
  size: string,
  quantity = 1,
): CoveragePosition => ({ id, size, color: 'Чёрный', quantity });

const sheet = (itemId: string | null): CoverageApproval => ({
  itemId,
  previewFile: `${itemId ?? 'none'}.png`,
  deliveryStatus: null,
});

const sentSheet = (itemId: string | null): CoverageApproval => ({
  ...sheet(itemId),
  deliveryStatus: 'SENT',
});

describe('макеты по позициям', () => {
  const positions = [
    position('a', 'S'),
    position('b', 'M'),
    position('c', 'L'),
  ];

  it('каждая позиция смотрит только на свои макеты', () => {
    const coverage = approvalCoverage(positions, [sentSheet('a'), sheet('b')]);

    expect(coverage.map((c) => [c.position.size, c.ready, c.sent])).toEqual([
      ['S', true, true],
      ['M', true, false],
      ['L', false, false],
    ]);
  });

  it('черновик без листа позицию не закрывает', () => {
    const draft: CoverageApproval = {
      itemId: 'a',
      previewFile: null,
      deliveryStatus: null,
    };
    expect(approvalCoverage([positions[0]], [draft])[0].ready).toBe(false);
  });

  it('количество в позиции второго макета не требует', () => {
    // «S × 2» — две одинаковые футболки по одному макету.
    const coverage = approvalCoverage([position('a', 'S', 2)], [sheet('a')]);
    expect(coverage[0].ready).toBe(true);
  });

  it('макет без привязки закрывает единственную позицию', () => {
    // Согласования, созданные до того, как макеты стали принадлежать
    // позициям. В заказе с одной позицией относиться они могли только к ней.
    expect(approvalCoverage([position('a', 'S')], [sheet(null)])[0].ready).toBe(
      true,
    );
  });

  it('макет без привязки в заказе на три размера не закрывает ничего', () => {
    // Именно здесь и неизвестно, какой из размеров на листе изображён.
    const coverage = approvalCoverage(positions, [sheet(null)]);
    expect(coverage.every((c) => !c.ready)).toBe(true);
  });
});

describe('что мешает отправить заказ исполнителю', () => {
  const positions = [position('a', 'S'), position('b', 'M')];

  it('макеты собраны и файлов хватает — дорога открыта', () => {
    expect(
      dispatchBlockers({
        coverage: approvalCoverage(positions, [sheet('a'), sheet('b')]),
        techSpecCount: 2,
      }),
    ).toEqual([]);
  });

  it('несобранный макет называет размер, которого не хватает', () => {
    const [blocker] = dispatchBlockers({
      coverage: approvalCoverage(positions, [sheet('a')]),
      techSpecCount: 2,
    });
    expect(blocker).toContain('M(48)');
    expect(blocker).not.toContain('S(46)');
  });

  it('неотправленный клиенту макет производство не держит', () => {
    /*
     * Так и выяснилось на живом заказе 20261105-037: ник клиента вёл не на
     * личный аккаунт, Telegram отказал (not_user), и заказ не уходил в
     * печать из-за того, до чего менеджеру не дотянуться. Лист клиенту
     * отправляет человек, а печать ждать этого не должна.
     */
    expect(
      dispatchBlockers({
        coverage: approvalCoverage(positions, [sheet('a'), sheet('b')]),
        techSpecCount: 2,
      }).join(' '),
    ).not.toContain('клиент');
  });

  it('ТЗ-файлов меньше, чем позиций — отправка закрыта', () => {
    const blockers = dispatchBlockers({
      coverage: approvalCoverage(positions, [sheet('a'), sheet('b')]),
      techSpecCount: 1,
    });
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toContain('ТЗ-файлов 1, а позиций 2');
  });

  it('количество в позиции в число файлов не складывается', () => {
    // «S × 3» — три одинаковые футболки по одному файлу: требовать три
    // копии одного и того же бессмысленно.
    expect(
      dispatchBlockers({
        coverage: approvalCoverage([position('a', 'S', 3)], [sheet('a')]),
        techSpecCount: 1,
      }),
    ).toEqual([]);
  });

  it('заказ без позиций футболок по-прежнему требует хотя бы один файл', () => {
    // Печать на изделии клиента: позиция свободная, макетов нет.
    expect(
      dispatchBlockers({ coverage: [], techSpecCount: 0 }),
    ).toHaveLength(1);
    expect(dispatchBlockers({ coverage: [], techSpecCount: 1 })).toEqual([]);
  });
});

describe('допуск заказа в производство', () => {
  const positions = [position('a', 'S'), position('b', 'M')];
  const covered = [sheet('a'), sheet('b')];
  const base = {
    tshirtItems: positions,
    techSpecPhotoPaths: ['one.jpg', 'two.jpg'],
  };

  it('листы собраны, файлов по числу позиций — можно отправлять', () => {
    expect(orderDispatchBlockers(base, covered)).toEqual([]);
  });

  it('без макета на позицию дорога закрыта', () => {
    const blockers = orderDispatchBlockers(base, [sheet('a')]);
    expect(blockers[0]).toContain('Макет не собран');
    expect(blockers[0]).toContain('M(48)');
  });

  it('старое поле с одним ТЗ-файлом считается наравне с новым', () => {
    // techSpecPhotoPath — одиночный файл у заказов, заведённых раньше.
    const blockers = orderDispatchBlockers(
      { tshirtItems: positions, techSpecPhotoPath: 'single.jpg' },
      covered,
    );
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toContain('ТЗ-файлов 1, а позиций 2');
  });
});
