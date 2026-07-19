-- =============================================================================
-- ResQGo — デモ用 SOS シード（検索タブ・地図ピン用）
-- =============================================================================
-- 固定 UUID + ON CONFLICT で再適用しても idempotent。本番 SOS は触らない。

insert into public.emergency_locations (
  id, title, description, contact_info, priority, status, created_by, location
)
values
  (
    'a0000001-0000-4000-8000-000000000001'::uuid,
    '避難所の水と食料が不足',
    '避難者約30名。飲み水と保存食の追加支援が必要。到着可能な時間帯があれば記載してください。',
    '090-1234-0001（避難所担当）',
    'high',
    'open',
    null,
    st_setsrid(st_makepoint(139.7540, 35.6955), 4326)::geography
  ),
  (
    'a0000002-0000-4000-8000-000000000002'::uuid,
    '2階に避難者3名、水と毛布が必要',
    '1階浸水のため2階に避難。出入り口使用不可。救急箱も不足しています。',
    '080-2345-0002',
    'high',
    'open',
    null,
    st_setsrid(st_makepoint(139.7680, 35.6820), 4326)::geography
  ),
  (
    'a0000003-0000-4000-8000-000000000003'::uuid,
    'けが人あり、医療支援が必要',
    '転倒で足を怪我。止血済みだが搬送または応急処置が必要。高齢者1名。',
    '070-3456-0003',
    'high',
    'open',
    null,
    st_setsrid(st_makepoint(139.7520, 35.6720), 4326)::geography
  ),
  (
    'a0000004-0000-4000-8000-000000000004'::uuid,
    '高齢者1名、一人で動けない',
    '自力避難困難。車椅子使用。近隣に家族不在。定期的な安否確認を希望。',
    '090-4567-0004',
    'medium',
    'open',
    null,
    st_setsrid(st_makepoint(139.7010, 35.6920), 4326)::geography
  ),
  (
    'a0000005-0000-4000-8000-000000000005'::uuid,
    '乳幼児2名、おむつとミルクが必要',
    '避難所到着済み。おむつ・粉ミルク・哺乳瓶の支援が必要。',
    '080-5678-0005',
    'medium',
    'open',
    null,
    st_setsrid(st_makepoint(139.7600, 35.6650), 4326)::geography
  )
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  contact_info = excluded.contact_info,
  priority = excluded.priority,
  status = excluded.status,
  location = excluded.location;
