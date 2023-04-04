import { FC, useEffect, useState } from 'react';
import GlobalContext from '@contexts/global';
import {
  defaultModel,
  globalConfigLocalKey,
  localConversationKey,
} from '@configs';
import type { Conversation, GlobalConfig, Lang, Message } from '@interfaces';
import type { I18n } from '@utils/i18n';
import { Tooltip } from 'antd';
import MessageBox from './MessageBox';
import MessageInput from './MessageInput';
import GlobalConfigs from './GlobalConfigs';
import ClearMessages from './ClearMessages';
import ConversationTabs from './ConversationTabs';

import logo from '../assets/logo.png';

const defaultConversation: Omit<Conversation, 'title'> = {
  id: '1',
  messages: [],
  mode: 'text',
  createdAt: Date.now(),
};

const Main: FC<{ i18n: I18n; lang: Lang }> = ({ i18n, lang }) => {
  // input text
  const [text, setText] = useState('');

  // chat informations
  const [currentTab, setCurrentTab] = useState<string>('1');
  const [conversations, setConversations] = useState<
    Record<string, Conversation>
  >({
    [defaultConversation.id]: {
      ...defaultConversation,
      title: i18n.status_empty,
    },
  });

  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  // gloabl configs
  const [configs, setConfigs] = useState<GlobalConfig>({
    openAIApiKey: '',
    model: defaultModel,
    save: false,
    continuous: true,
    imagesCount: 1,
  });

  // prompt
  const [showPrompt, setShowPrompt] = useState(false);

  // media query
  const [isMobile, setIsMobile] = useState(false);

  const tabs = Object.values(conversations)
    .reverse()
    .map((conversation) => ({
      label: (
        <span>
          {conversation.mode === 'image' ? (
            <i className="ri-image-line align-bottom" />
          ) : (
            <i className="ri-chat-4-line align-bottom" />
          )}
          <span className="ml-1">{conversation.title}</span>
        </span>
      ),
      key: conversation.id,
    }));
  const currentMessages = conversations[currentTab]?.messages ?? [];
  const currentMode = conversations[currentTab]?.mode ?? 'text';

  // media query
  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    if (media.matches) {
      setIsMobile(true);
    }
  }, []);

  useEffect(() => {
    // read from localstorage in the first time
    const localConfigsStr = localStorage.getItem(globalConfigLocalKey);
    if (localConfigsStr) {
      try {
        const localConfigs = JSON.parse(localConfigsStr);
        setConfigs((currentConfigs) => ({
          ...currentConfigs,
          ...localConfigs,
        }));
        if (localConfigs.save) {
          const localConversation = localStorage.getItem(localConversationKey);
          if (localConversation) {
            const conversation = JSON.parse(localConversation);
            // historical localstorage
            if (Array.isArray(conversation) && conversation.length > 0) {
              setConversations({
                [defaultConversation.id]: {
                  title: conversation[0].content,
                  messages: conversation,
                  id: defaultConversation.id,
                  createdAt: Date.now(),
                },
              });
            } else {
              setConversations(conversation);
              setCurrentTab(
                Object.keys(conversation)?.reverse()?.[0] ??
                  defaultConversation.id
              );
            }
          }
        }
      } catch (e) {
        //
      }
    }
  }, []);

  // save current conversation
  useEffect(() => {
    if (configs.save) {
      localStorage.setItem(localConversationKey, JSON.stringify(conversations));
    } else {
      localStorage.removeItem(localConversationKey);
    }
  }, [conversations, configs.save]);

  const updateMessages = (messages: Message[]) => {
    setConversations((msg) => ({
      ...msg,
      [currentTab]: {
        ...conversations[currentTab],
        messages,
        ...(messages.length > 0
          ? {
              title: messages[0].content,
            }
          : {}),
      },
    }));
  };

  const sendTextChatMessages = async (content: string) => {
    const current = currentTab;
    const input: Message[] = [
      {
        role: 'user',
        content,
        createdAt: Date.now(),
      },
    ];
    const allMessages: Message[] = currentMessages.concat(input);
    updateMessages(allMessages);
    setText('');
    setLoadingMap((map) => ({
      ...map,
      [current]: true,
    }));
    try {
      const res = await fetch('/api/completions', {
        method: 'POST',
        body: JSON.stringify({
          key: configs.openAIApiKey,
          model: configs.model,
          messages: configs.continuous ? allMessages : input,
        }),
      });
      const { data, msg } = await res.json();
      if (res.status < 400) {
        updateMessages(
          allMessages.concat([
            {
              ...data,
              createdAt: Date.now(),
            },
          ])
        );
      } else {
        updateMessages(
          allMessages.concat([
            {
              role: 'assistant',
              content: `Error: ${msg || 'Unknown'}`,
              createdAt: Date.now(),
            },
          ])
        );
      }
    } catch (e) {
      updateMessages(
        allMessages.concat([
          {
            role: 'assistant',
            content: `Error: ${e.message || e.stack || e}`,
            createdAt: Date.now(),
          },
        ])
      );
    }
    setLoadingMap((map) => ({
      ...map,
      [current]: false,
    }));
  };

  const sendImageChatMessages = async (content: string) => {
    const current = currentTab;
    const allMessages: Message[] = currentMessages.concat([
      {
        role: 'user',
        content,
        createdAt: Date.now(),
      },
    ]);
    updateMessages(allMessages);
    setText('');
    setLoadingMap((map) => ({
      ...map,
      [current]: true,
    }));
    try {
      const res = await fetch('/api/images', {
        method: 'POST',
        body: JSON.stringify({
          key: configs.openAIApiKey,
          prompt: content,
          size: '256x256',
          n: configs.imagesCount || 1,
        }),
      });
      const { data = [], msg } = await res.json();

      if (res.status < 400) {
        const params = new URLSearchParams(data?.[0]);
        const expiredAt = params.get('se');
        updateMessages(
          allMessages.concat([
            {
              role: 'assistant',
              content: data.map((url) => `![](${url})`).join('\n'),
              createdAt: Date.now(),
              expiredAt: new Date(expiredAt).getTime(),
            },
          ])
        );
      } else {
        updateMessages(
          allMessages.concat([
            {
              role: 'assistant',
              content: `Error: ${msg || 'Unknown'}`,
              createdAt: Date.now(),
            },
          ])
        );
      }
    } catch (e) {
      updateMessages(
        allMessages.concat([
          {
            role: 'assistant',
            content: `Error: ${e.message || e.stack || e}`,
            createdAt: Date.now(),
          },
        ])
      );
    }
    setLoadingMap((map) => ({
      ...map,
      [current]: false,
    }));
  };

  return (
    <GlobalContext.Provider value={{ i18n, lang, isMobile }}>
      <header>
        <div className="flex items-center justify-between">
          <div className="flex items-baseline">
            <span className="title text-gradient">AI语伴</span>
            {/* <a
              href="https://xiu.ee"
              target="_blank"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </a> */}
          </div>
          <GlobalConfigs configs={configs} setConfigs={setConfigs} />
        </div>
        <ConversationTabs
          tabs={tabs}
          setConversations={setConversations}
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
        />
      </header>
      <MessageBox
        messages={currentMessages}
        loading={loadingMap[currentTab]}
        mode={currentMode}
      />
      <footer>
        <MessageInput
          text={text}
          setText={setText}
          showPrompt={showPrompt && currentMode !== 'image'}
          setShowPrompt={setShowPrompt}
          onSubmit={async (message: string) => {
            if (currentMode === 'image') {
              sendImageChatMessages(message);
            } else {
              sendTextChatMessages(message);
            }
          }}
          loading={loadingMap[currentTab]}
        />
        <div className="flex items-center justify-between pr-8">
          <Tooltip title={i18n.action_prompt}>
            <div
              className="flex items-center cursor-pointer p-1 text-gray-500"
              onClick={() => {
                setText('/');
                setShowPrompt(true);
              }}
            >
              {/* <i className="ri-user-add-line" /> */}
              预设
            </div>
          </Tooltip>
          <ClearMessages
            onClear={() =>
              setConversations({
                [defaultConversation.id]: {
                  ...defaultConversation,
                  title: i18n.status_empty,
                },
              })
            }
          />
        </div>
      </footer>
      <div
        style={{
          position: 'absolute',
          bottom: '40%',
          textAlign: 'center',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999999',
          gap: '12px',
          zIndex: '-1',
        }}
      >
        <img src={logo} style={{ width: '100px' }} />
        <span>我是人工智能聊天机器人AI语伴，快来和我聊天吧！</span>
      </div>
    </GlobalContext.Provider>
  );
};

export default Main;
