let accrualsList: IAccrualsTable[] = [];
let monthlyAccrualsList: IMonthlyAccrualsTable[] = [];

interface IAccrualsTable {
    period: string; // Период
    accrued: number; // Начислено
    prepaid: number; // Аванс
    salary: number; // ЗП
    paid: number; // Выплачено
    difference: number; // разница
}

interface IMonthlyAccrualsTable {
    period: string; // Период
    specialization: string; // Специализация
    client_project: string; // Клиент, проект
    projectTask: string; // Проектная задача
    task: string; // Задание
    role: string; // Роль
    accrued: number; // Начислено
    ndfl: number; // Налог
    total: number; // На руки
}

// Инициализация проекта
async function onInit(): Promise<void> {
    await onProjects();
}

// Получение начислений
function getAccruals() {
    return accrualsList;
}

// Получение ежемесячных начислений
function getMonthlyAccruals() {
    return monthlyAccrualsList;
}

async function onProjects() {
    // Входящий период
    const inputYear = Context.data.year?.name;

    const [accruals, tabels] = await Promise.all([
        Global.ns.finance.app.accruals.search().size(1000).all(),
        Global.ns.finance.app.tabels.search().size(1000).all()
    ]);

    // Объект для хранения сумм по периодам
    const accrualsMap: { [key: string]: IAccrualsTable } = {};

    for (const tabel of tabels) {
        for (const accrual of accruals) {
            if (accrual.data.tabel
                && Context.data.system_user
                && tabel.data.system_user
                && tabel.data.__id === accrual.data.tabel.id
                && tabel.data.system_user.id === Context.data.system_user.id
                && !accrual.data.__deletedAt
                && accrual.data.__status
                && (accrual.data.__status.code === 'report' || accrual.data.__status.code === 'end')) {
                const accrual_period = await accrual.data.period?.fetch();

                // Получаем год из периода начисления
                const periodName = accrual_period?.data.__name || "Без периода";
                const periodTrimmed = periodName.trim();
                const periodMatch = periodTrimmed.match(/\d{4}$/);

                if (!periodMatch) {
                    continue;
                }

                // Получаем год из периода начисления
                const year = parseInt(periodMatch[0], 10);

                if (year.toString() === inputYear) {
                    // Проект, задача, задание, специализация
                    const [accrual_task, accrual_project, accrual_projectTask, specialization] = await Promise.all([
                        accrual.data.zadanie?.fetch(),
                        accrual.data.project?.fetch(),
                        accrual.data.zadanie?.fetch().then(task => task.data.project_task?.fetch()),
                        accrual.data.zadanie?.fetch().then(task => task.data.specializaciya?.fetch())
                    ]);

                    // Рассчитываем суммы
                    const accrued = accrual.data.sum ? accrual.data.sum.asFloat() : 0;
                    const ndfl = accrual.data.ndfl ? accrual.data.ndfl.asFloat() : 0;
                    const total = accrual.data.total ? accrual.data.total.asFloat() : 0;
                    const prepaid = total / 2;
                    const salary = total - prepaid;
                    const paid = 0;
                    const difference = 0;

                    // Поля для объекта
                    const specializationName = specialization?.data.__name || "Нет специализации";
                    const projectTaskName = accrual_projectTask?.data.__name || "Нет проектной задачи";
                    const taskName = accrual_task?.data.__name || "Нет задачи";
                    const roleName = accrual.data.role ? accrual.data.role.name : "";

                    // Если период уже существует в accrualsMap, суммируем значения
                    if (accrualsMap[periodName]) {
                        accrualsMap[periodName].accrued += total;
                        accrualsMap[periodName].prepaid += prepaid;
                        accrualsMap[periodName].salary += salary;
                        accrualsMap[periodName].paid += paid;
                        accrualsMap[periodName].difference += difference;
                    } else {
                        // Если периода нет, создаем новую запись
                        accrualsMap[periodName] = {
                            period: periodName,
                            accrued: total,
                            prepaid: prepaid,
                            salary: salary,
                            paid: paid,
                            difference: difference
                        };
                    }

                    // Детальное отображение для второй таблицы
                    const detail: IMonthlyAccrualsTable = {
                        period: periodName,
                        specialization: specializationName,
                        client_project: printCustomer(accrual.data.client_name, accrual_project?.data.__name),
                        projectTask: projectTaskName,
                        task: taskName,
                        role: roleName,
                        accrued: convertToFixed(accrued),
                        ndfl: convertToFixed(ndfl),
                        total: convertToFixed(total),
                    }

                    monthlyAccrualsList.push(detail);
                }
            }
        }
    }

    // accrualsMap в массив
    accrualsList = Object.keys(accrualsMap).map(key => accrualsMap[key]);

    // Записи без периода в конец
    accrualsList.sort((a, b) => {
        if (a.period === "Без периода") return 1;
        if (b.period === "Без периода") return -1;
        return a.period.localeCompare(b.period);
    });
}

// Убрать знаки после запятой
function convertToFixed(item: number):number {
    return Number(item.toFixed(3));
}

// Вывод клиента-проекта
function printCustomer(client: string | undefined, project: string | undefined): string {
    switch (true) {
        case !!client && !!project:
            return `${client} / ${project}`;
        case !!client:
            return client!;
        case !!project:
            return project!;
        default:
            return "Нет клиента и проекта";
    }
}