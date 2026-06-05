import { StyleSheet } from '@react-pdf/renderer';

export const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    paddingTop: 40,
    paddingLeft: 40,
    paddingRight: 40,
    paddingBottom: 80,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
    borderBottomStyle: 'solid',
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    borderTopStyle: 'solid',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 8,
    color: '#6B7280',
  },
  pageNumber: {
    fontSize: 8,
    color: '#6B7280',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    borderBottomStyle: 'solid',
  },
  subsection: {
    marginTop: 8,
    paddingLeft: 16,
  },
  subsectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 6,
  },
  contentText: {
    fontSize: 10,
    color: '#374151',
    lineHeight: 1.6,
  },
  ratingContainer: {
    marginTop: 12,
    marginBottom: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
  },
  ratingScore: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
  },
  progressBarGreen: {
    backgroundColor: '#10B981',
  },
  progressBarYellow: {
    backgroundColor: '#F59E0B',
  },
  progressBarRed: {
    backgroundColor: '#EF4444',
  },
  evaluationSummary: {
    fontSize: 9,
    color: '#6B7280',
    lineHeight: 1.5,
    marginTop: 8,
  },
  metadataContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  metadataItem: {
    fontSize: 8,
    color: '#6B7280',
  },
  metadataLabel: {
    fontWeight: 'bold',
    color: '#374151',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 8,
    fontWeight: 'bold',
    alignSelf: 'flex-start',
  },
  badgeSuccess: {
    backgroundColor: '#DEF7EC',
    color: '#03543F',
  },
  badgeWarning: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
  },
  badgeDanger: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    borderBottomStyle: 'solid',
    marginVertical: 12,
  },
});
