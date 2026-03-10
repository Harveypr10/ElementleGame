-- =================================================================
-- Populate "Testers" league (be94b0e7-...) with all test users
-- Uses "FirstName L" nickname format where last_name is available
-- =================================================================

DO $$
DECLARE
    v_league_id uuid := 'be94b0e7-639f-436b-a71a-d8e2a8f2ee95';
    v_user_id uuid;
BEGIN

-- Insert all members in one go
INSERT INTO public.league_members (league_id, user_id, league_nickname, can_share, is_active)
VALUES
    (v_league_id, 'a04d7085-ea74-4363-a9b3-3ea62992bffc', 'Adrian C', false, true),
    (v_league_id, '6d1d5a3e-fb63-44f2-8474-eb0feee1499c', 'Barbara H', false, true),
    (v_league_id, '61a93396-518d-4820-9e5d-e2b4432e323a', 'Bradford J', false, true),
    (v_league_id, '70c08645-1305-490d-b3a1-7ec869559dd2', 'James H', false, true),
    (v_league_id, '9487ebb2-2dd4-4eb3-8e58-88ddbff8ba4b', 'Celia S', false, true),
    (v_league_id, '05e2cc5d-2a80-43c0-8bec-33ff8b2ff958', 'Stephen H', false, true),
    (v_league_id, '791868b0-7ff3-4f53-b6ed-c97859030c48', 'Sarah F', false, true),
    (v_league_id, '15c83047-3871-46f0-beae-dd84adfe6010', 'Conor Q', false, true),
    (v_league_id, 'f29f1bd7-767d-443d-a5dd-92ff17e2674d', 'Player', false, true),
    (v_league_id, '28614b28-c210-460c-9cdc-a38451a2d473', 'Amy E', false, true),
    (v_league_id, '08632aa9-2d87-4307-8d05-70a34ae9f2da', 'Matthew F', false, true),
    (v_league_id, 'd3c0128e-bac9-4f0f-95ff-fdfee6efd8cd', 'Freddie G', false, true),
    (v_league_id, 'ee57a124-ce97-4437-bb3d-8c72f219f0a9', 'Gemma H', false, true),
    (v_league_id, 'd5080a9f-d3a2-4749-aa2d-b99d80c9e40b', 'Hamish W', false, true),
    (v_league_id, 'cb34dd0f-511b-4337-894b-645d4ebf03e9', 'Christian H', false, true),
    (v_league_id, 'a6ba7e98-900e-4b35-a4c6-25f3ee09f45c', 'Adrian H', false, true),
    (v_league_id, '46a4f9b7-f146-4d57-b7ec-57b1d22c103e', 'Helen', false, true),
    (v_league_id, 'd66192a3-92ef-44a6-9c18-66fa6814ce4f', 'Ian H', false, true),
    (v_league_id, 'aebef01f-1aff-4fba-a592-46c41a5a925d', 'James H', false, true),
    (v_league_id, '1c2c95b7-9fe9-4176-970b-16f36810c857', 'James W', false, true),
    (v_league_id, 'a61c360f-8832-4320-b19d-9faea5e5890f', 'Jasmine', false, true),
    (v_league_id, '46f4f862-e1bf-4d0b-b80e-71bdf26ee129', 'James H', false, true),
    (v_league_id, '4434f7c8-4700-4e6a-a7e6-f14553a78e78', 'Jonathan P', false, true),
    (v_league_id, 'de2c467a-856e-4910-b5b4-e8f9b97fca41', 'Julie B', false, true),
    (v_league_id, '899ea3ad-ba05-413b-93d2-3c089caa1377', 'Kate B', false, true),
    (v_league_id, 'dba72623-b839-439f-9be8-a4aa6422d7f9', 'Louise J', false, true),
    (v_league_id, '3242e278-d3d5-446d-94ee-aa9e5f570517', 'Lucy A', false, true),
    (v_league_id, 'a6753357-8795-44ab-a8ed-51d53a5bb37d', 'Magnus R', false, true),
    (v_league_id, '2c4c6802-80ce-4e57-9433-7076f272ac2e', 'Max J', false, true),
    (v_league_id, '2f367542-0367-44ce-b48d-50aa74dec779', 'Mark R', false, true),
    (v_league_id, 'e14a7c1a-7a17-4f32-92ee-07cefe85da1c', 'Mark S', false, true),
    (v_league_id, '30e4f6c2-75ba-48f8-bec6-f5cdb0bb0842', 'Mary H', false, true),
    (v_league_id, 'a67967d4-22ad-4d4a-87fd-5a824ea699e9', 'Jack B', false, true),
    (v_league_id, 'cee5354f-df03-4578-9e10-6110c0391ffb', 'Nick B', false, true),
    (v_league_id, 'd41a864d-3439-4995-8aee-73738b588050', 'Paul H', false, true),
    (v_league_id, 'f0e4ccf2-9757-45f2-a15c-27653ff97333', 'Piers K', false, true),
    (v_league_id, '2006e49a-1151-47c0-9f58-9388a87034e1', 'Helen B', false, true),
    (v_league_id, '61485fd9-c750-43a8-b076-213b614b105d', 'Sam R', false, true),
    (v_league_id, '5b08bf76-6120-49b9-9a36-d7ef754e8b66', 'Sebastian C', false, true),
    (v_league_id, '58de56f8-7e48-4a53-a899-3a089a68111f', 'Eleanor O', false, true),
    (v_league_id, '8d81142d-a4b1-4bd3-a535-81708e208245', 'Tim M', false, true),
    (v_league_id, '1b5da510-de54-4bc7-b2dd-c02fa353cf27', 'Toby P', false, true),
    (v_league_id, '2ba006ac-c4db-43ff-b3c1-4803e22282a2', 'Tom H', false, true),
    (v_league_id, '2f996b29-7658-4901-bdfb-74086a79c467', 'Anne G', false, true),
    (v_league_id, 'a449c00b-4311-437f-a853-ede81e9e6292', 'Zephaniah', false, true)
ON CONFLICT (league_id, user_id) DO NOTHING;

-- Hydrate standings for each member
FOR v_user_id IN
    SELECT user_id FROM public.league_members WHERE league_id = v_league_id
LOOP
    PERFORM public.hydrate_member_standings(v_user_id, v_league_id);
END LOOP;

-- Recalculate timezone
PERFORM public.recalculate_league_timezone(v_league_id);

RAISE NOTICE 'Done: % members added to Testers league', (
    SELECT count(*) FROM public.league_members WHERE league_id = v_league_id
);

END $$;
