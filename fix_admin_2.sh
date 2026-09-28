#!/bin/bash
sed -i '31219,31225d' src/components/AdminPanel.tsx
echo '          </div>' >> src/components/AdminPanel.tsx
echo '        </div>' >> src/components/AdminPanel.tsx
echo '      )}' >> src/components/AdminPanel.tsx
echo '    </div>' >> src/components/AdminPanel.tsx
echo '  );' >> src/components/AdminPanel.tsx
echo '}' >> src/components/AdminPanel.tsx
